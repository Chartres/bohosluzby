# ASC screenshot-set reconciliation: verify_listing (read back what you
# publish — FLYWHEEL-STANDARD §11 Rule 15, born from the v1.0 screenshot-dupe
# incident) and dedupe_screenshots (the v1.1 cleanup for it). Built on
# asc_api.rb's raw JWT client, not spaceship — spaceship's newer endpoints
# bit this repo before (see Fastfile build lane comment re: betaBuildMetrics).
require_relative 'asc_api'

# ponytail: only the two device buckets this repo ships today. Add a row if
# a new screenshot size shows up in fastlane/screenshots — verify_listing!
# fails loud naming the unknown prefix instead of silently skipping it.
# (Mapping confirmed against the live ASC listing: 6.9" iPhone shots and 13"
# iPad shots both post to the legacy-named "67"/"3GEN_129" display types.)
DEVICE_DISPLAY_TYPES = {
  'iphone-6.9' => 'APP_IPHONE_67',
  'ipad-13'    => 'APP_IPAD_PRO_3GEN_129',
}.freeze

# appStoreVersion states the API still lets you edit screenshots/metadata on.
EDITABLE_STATES = %w[
  PREPARE_FOR_SUBMISSION
  DEVELOPER_REJECTED
  REJECTED
  METADATA_REJECTED
  INVALID_BINARY
].freeze

def asc_app_id(env, bundle_id)
  _, body = asc_request(env, 'GET', "/v1/apps?filter[bundleId]=#{bundle_id}")
  body.fetch('data').fetch(0).fetch('id')
end

def asc_app_versions(env, app_id)
  _, body = asc_request(env, 'GET', "/v1/apps/#{app_id}/appStoreVersions?fields[appStoreVersions]=versionString,appStoreState")
  body.fetch('data')
end

# Editable version if one exists (prefer_editable), else the newest version
# overall — e.g. the live one, pre-v1.1, when verify_listing runs against it.
def pick_version(env, app_id, prefer_editable:)
  versions = asc_app_versions(env, app_id)
  editable = versions.select { |v| EDITABLE_STATES.include?(v.dig('attributes', 'appStoreState')) }
  pool = prefer_editable && !editable.empty? ? editable : versions
  pool.max_by { |v| v.dig('attributes', 'versionString').to_s }
end

def localizations(env, version_id)
  _, body = asc_request(env, 'GET', "/v1/appStoreVersions/#{version_id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale")
  body.fetch('data')
end

def screenshot_sets(env, localization_id)
  _, body = asc_request(env, 'GET', "/v1/appStoreVersionLocalizations/#{localization_id}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType")
  body.fetch('data')
end

# id + fileName for every screenshot in a set (10 max per Apple's own limit,
# well under the API's 50 default page size — no pagination needed).
def screenshots_in_set(env, set_id)
  _, body = asc_request(env, 'GET', "/v1/appScreenshotSets/#{set_id}/appScreenshots?fields[appScreenshots]=fileName")
  body.fetch('data')
end

# Local screenshots grouped by device bucket per locale, e.g.
# {"cs" => {"iphone-6.9" => ["iphone-6.9-1-home.png", ...]}}
def local_screenshots(screenshots_dir)
  Dir.glob(File.join(screenshots_dir, '*')).select { |d| File.directory?(d) }.each_with_object({}) do |locale_dir, out|
    locale = File.basename(locale_dir)
    files = Dir.glob(File.join(locale_dir, '*.png')).map { |f| File.basename(f) }.sort
    out[locale] = files.group_by { |f| f.split('-').first(2).join('-') }
  end
end

# Raises with the full diff if any locale/device-bucket's ASC screenshot
# count doesn't match what's in fastlane/screenshots.
def verify_listing!(env, app_id, screenshots_dir)
  version = pick_version(env, app_id, prefer_editable: true)
  raise "verify_listing: no appStoreVersion found for app #{app_id}" unless version

  diffs = []
  locs = localizations(env, version['id'])
  local_screenshots(screenshots_dir).each do |locale, groups|
    loc = locs.find { |l| l.dig('attributes', 'locale') == locale }
    unless loc
      diffs << "#{locale}: no appStoreVersionLocalization on ASC (version #{version.dig('attributes', 'versionString')})"
      next
    end
    remote_by_type = screenshot_sets(env, loc['id']).each_with_object({}) do |s, h|
      h[s.dig('attributes', 'screenshotDisplayType')] = s['id']
    end
    groups.each do |prefix, files|
      display_type = DEVICE_DISPLAY_TYPES[prefix]
      unless display_type
        diffs << "#{locale}/#{prefix}: no known ASC screenshotDisplayType mapping — add it to DEVICE_DISPLAY_TYPES in screenshot_ops.rb"
        next
      end
      set_id = remote_by_type[display_type]
      remote_count = set_id ? screenshots_in_set(env, set_id).size : 0
      diffs << "#{locale}/#{prefix} (#{display_type}): local #{files.size}, ASC #{remote_count}" if remote_count != files.size
    end
  end

  raise "verify_listing: ASC screenshot counts don't match local:\n  #{diffs.join("\n  ")}" unless diffs.empty?

  puts "verify_listing: OK — ASC screenshot counts match local (version #{version.dig('attributes', 'versionString')})"
end

# True when every local screenshot bucket already matches ASC exactly
# (same fileNames, same counts, no dupes) — release lane uses this to skip
# re-uploading and appending duplicates.
def screenshots_unchanged?(env, app_id, screenshots_dir)
  version = pick_version(env, app_id, prefer_editable: true)
  return false unless version

  locs = localizations(env, version['id'])
  local_screenshots(screenshots_dir).all? do |locale, groups|
    loc = locs.find { |l| l.dig('attributes', 'locale') == locale }
    next false unless loc

    remote_by_type = screenshot_sets(env, loc['id']).each_with_object({}) do |s, h|
      h[s.dig('attributes', 'screenshotDisplayType')] = s['id']
    end
    groups.all? do |prefix, files|
      set_id = remote_by_type[DEVICE_DISPLAY_TYPES[prefix]]
      next false unless set_id

      remote_files = screenshots_in_set(env, set_id).map { |s| s.dig('attributes', 'fileName') }.sort
      remote_files == files.sort
    end
  end
end

# For an EDITABLE appStoreVersion only: delete duplicate appScreenshots by
# fileName within each set, keeping the first. Refuses loudly on a live
# version instead of letting the API 409.
def dedupe_screenshots!(env, app_id)
  version = pick_version(env, app_id, prefer_editable: false)
  raise "dedupe_screenshots: no appStoreVersion found for app #{app_id}" unless version

  state = version.dig('attributes', 'appStoreState')
  unless EDITABLE_STATES.include?(state)
    raise "dedupe_screenshots: appStoreVersion #{version.dig('attributes', 'versionString')} is #{state}, not editable — " \
          'screenshots on a live/in-review version can\'t be changed via the API (this is Apple\'s 409, by design). ' \
          'Run this once v1.1 exists and is editable.'
  end

  deleted = 0
  localizations(env, version['id']).each do |loc|
    screenshot_sets(env, loc['id']).each do |set|
      screenshots_in_set(env, set['id']).group_by { |s| s.dig('attributes', 'fileName') }.each do |file_name, shots|
        next if shots.size <= 1

        shots.drop(1).each do |dupe|
          asc_request(env, 'DELETE', "/v1/appScreenshots/#{dupe['id']}")
          deleted += 1
          puts "dedupe_screenshots: deleted duplicate #{file_name} (#{dupe['id']}) from #{set.dig('attributes', 'screenshotDisplayType')}"
        end
      end
    end
  end
  puts "dedupe_screenshots: done, #{deleted} duplicate screenshot(s) removed"
  deleted
end
