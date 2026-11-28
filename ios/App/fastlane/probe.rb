# Read-only: print what the App Store Connect API offers for this app (relationship names and
# links), to find where newer listing slots live before scripting an upload. Changes nothing.
require_relative 'asc_api'

def rel_names(obj)
  (obj['relationships'] || {}).map { |k, v| "#{k} → #{v.dig('links', 'related')}" }
end

def probe!(env, app_id)
  _, app = asc_request(env, 'GET', "/v1/apps/#{app_id}")
  puts "probe: app relationships:"
  rel_names(app['data']).each { |l| puts "  #{l}" }
  _, infos = asc_request(env, 'GET', "/v1/apps/#{app_id}/appInfos")
  info = infos['data'].first
  puts "probe: appInfo #{info['id']} state #{info.dig('attributes', 'appStoreState') || info.dig('attributes', 'state')}"
  rel_names(info).each { |l| puts "  #{l}" }
  _, vs = asc_request(env, 'GET', "/v1/apps/#{app_id}/appStoreVersions?limit=3")
  vs['data'].each { |v| puts "probe: version #{v.dig('attributes', 'versionString')} #{v.dig('attributes', 'appStoreState')}" }
  v = vs['data'].first
  rel_names(v).each { |l| puts "  #{l}" }
  _, locs = asc_request(env, 'GET', "/v1/appStoreVersions/#{v['id']}/appStoreVersionLocalizations")
  loc = locs['data'].first
  puts "probe: version localization #{loc.dig('attributes', 'locale')}"
  rel_names(loc).each { |l| puts "  #{l}" }
  # stage 2 (28 Nov): the newer slots. GET only; print status and a short body.
  [
    "/v1/appStoreVersionLocalizations/#{loc['id']}/placements",
    "/v1/apps/#{app_id}/assetLibrary",
    "/v1/appAssetLibraryRefData",
    "/v1/appAssetLibraries/#{app_id}/images?limit=2",
  ].each do |path|
    begin
      code, body = asc_request(env, 'GET', path)
      puts "probe: GET #{path} → #{code}"
      puts "  #{JSON.generate(body)[0, 6000]}"
    rescue StandardError => e
      puts "probe: GET #{path} failed: #{e.message[0, 600]}"
    end
  end
end
