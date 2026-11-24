# Quick tour of an App Store version before submitting (read-only): is the build attached
# and processed, are release notes, description, screenshots and review details there, and
# what release type is set. Prints a report; returns the blockers (empty = ready).
# Raw JWT client (asc_api.rb), like screenshot_ops.rb.
require_relative 'asc_api'

def tour_report(version:, build:, version_build:, locs:, shot_counts:, review_detail:)
  lines = []
  blockers = []
  if version.nil?
    lines << "version: not created yet (the submit lane creates it from the repo files)"
    blockers << 'version missing'
    return [lines, blockers]
  end
  a = version['attributes']
  lines << "version #{a['versionString']}: #{a['appStoreState']}, release type #{a['releaseType']}"
  if build.nil?
    lines << "build: not uploaded"
    blockers << 'build missing'
  else
    b = build['attributes']
    lines << "build #{b['version']}: #{b['processingState']}#{b['expired'] ? ', EXPIRED' : ''}"
    blockers << "build #{b['version']} is #{b['processingState']}" unless b['processingState'] == 'VALID'
  end
  attached = version_build&.dig('attributes', 'version')
  lines << "attached build: #{attached || 'none (the submit lane attaches it)'}"
  locs.each do |l|
    la = l['attributes']
    notes = la['whatsNew'].to_s.strip
    desc = la['description'].to_s.strip
    lines << "#{la['locale']}: description #{desc.length} chars, release notes #{notes.length} chars, screenshots #{shot_counts[l['id']] || 0}"
    blockers << "#{la['locale']}: no description" if desc.empty?
    blockers << "#{la['locale']}: no screenshots" if (shot_counts[l['id']] || 0).zero?
    lines << "  ! #{la['locale']}: no release notes yet (the submit lane uploads them from metadata/)" if notes.empty?
  end
  lines << "review details: #{review_detail ? 'present' : 'MISSING'}"
  blockers << 'review details missing' unless review_detail
  [lines, blockers]
end

def tour!(env, app_id, version_string, build_number)
  _, vs = asc_request(env, 'GET', "/v1/apps/#{app_id}/appStoreVersions?filter[versionString]=#{version_string}&filter[platform]=IOS")
  version = vs.fetch('data').first
  _, bs = asc_request(env, 'GET', "/v1/builds?filter[app]=#{app_id}&filter[version]=#{build_number}&filter[preReleaseVersion.version]=#{version_string}")
  build = bs.fetch('data').first
  locs = []
  shots = {}
  review = nil
  version_build = nil
  if version
    _, vb = asc_request(env, 'GET', "/v1/appStoreVersions/#{version['id']}/build")
    version_build = vb.is_a?(Hash) ? vb['data'] : nil
    _, ls = asc_request(env, 'GET', "/v1/appStoreVersions/#{version['id']}/appStoreVersionLocalizations")
    locs = ls.fetch('data')
    locs.each do |l|
      _, sets = asc_request(env, 'GET', "/v1/appStoreVersionLocalizations/#{l['id']}/appScreenshotSets?include=appScreenshots")
      shots[l['id']] = (sets['included'] || []).length
    end
    _, rd = asc_request(env, 'GET', "/v1/appStoreVersions/#{version['id']}/appStoreReviewDetail")
    review = rd.is_a?(Hash) ? rd['data'] : nil
  end
  lines, blockers = tour_report(version: version, build: build, version_build: version_build, locs: locs, shot_counts: shots, review_detail: review)
  lines.each { |l| puts "tour: #{l}" }
  puts(blockers.empty? ? 'tour: READY' : "tour: BLOCKERS: #{blockers.join('; ')}")
  blockers
end
