# The iOS 27 product page creative assets: the header (3840×1646) and the search results image
# (3840×2560), from store-assets/ios/creative/ (Pavol asked for the upload, 28 Nov 2026).
#
# Flow, from Apple's live reference data (GET /v1/appAssetLibraryRefData lists both placement
# types under APP_STORE_VERSIONS, group DEFAULT_PROFILE, one each):
#   reserve the image in the app's asset library (category CREATIVE_ASSETS) → PUT the slices
#   Apple names → PATCH uploaded: true → wait for processing → place it on each localization of
#   the latest version → read the placements back.
# A slot that already holds a placement is left alone (placements can't be edited; replacing one
# is a delete, which this file never does). It never submits anything for review.
require_relative 'asc_api'
require 'json'

CREATIVE_GROUP = 'DEFAULT_PROFILE'
CREATIVE_TYPES = %w[PRODUCT_PAGE_HEADER_ASSET APP_STORE_SEARCH_RESULTS_ASSET].freeze
UPLOAD_STATES = %w[AWAITING_UPLOAD UPLOAD_COMPLETE PROCESSING].freeze
FAILED_STATES = %w[FAILED UPLOAD_FAILED PROCESSING_FAILED INVALID].freeze

def creative_todo(existing_placements, assets)
  filled = existing_placements.map { |p| p.dig('attributes', 'placementType') }
  assets.reject { |a| filled.include?(a[:type]) }
end

def reserve_body(library_id, asset)
  { data: { type: 'appAssetLibraryImages',
            attributes: { category: 'CREATIVE_ASSETS', fileName: asset[:name], fileSize: asset[:size] },
            relationships: { assetLibrary: { data: { type: 'appAssetLibraries', id: library_id } } } } }
end

def placement_body(type, image_id, localization_id)
  { data: { type: 'appAssetLibraryPlacements',
            attributes: { placementType: type, placementGroup: CREATIVE_GROUP },
            relationships: { image: { data: { type: 'appAssetLibraryImages', id: image_id } },
                             appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: localization_id } } } } }
end

def ok!(code, body, what)
  return body if code.to_s.start_with?('2')
  raise "#{what}: HTTP #{code} #{JSON.generate(body)[0, 800]}"
end

# req: (method, path, json_body_or_nil) → [code, parsed]; put: (op, bytes); read: path → bytes; wait: seconds.
def upload_creative!(app_id, assets, req:, put:, read:, wait:, log: [])
  lib = ok!(*req.call('GET', "/v1/apps/#{app_id}/assetLibrary"), 'asset library').dig('data', 'id')
  v = ok!(*req.call('GET', "/v1/apps/#{app_id}/appStoreVersions?limit=1"), 'versions')['data'].first
  log << "version #{v.dig('attributes', 'versionString')} #{v.dig('attributes', 'appStoreState')}"
  locs = ok!(*req.call('GET', "/v1/appStoreVersions/#{v['id']}/appStoreVersionLocalizations"), 'localizations')['data']
  library = ok!(*req.call('GET', "/v1/appAssetLibraries/#{lib}/images?limit=200"), 'library images')['data']
  images = {}
  assets.each do |a|
    old = library.find { |i| i.dig('attributes', 'fileName') == a[:name] && i.dig('attributes', 'category') == 'CREATIVE_ASSETS' && !(%w[ARCHIVED] + FAILED_STATES).include?(i.dig('attributes', 'state')) }
    next unless old
    images[a[:path]] = old['id']
    log << "#{a[:name]} already in the library: #{old.dig('attributes', 'state')}"
  end
  locs.each do |loc|
    locale = loc.dig('attributes', 'locale')
    existing = ok!(*req.call('GET', "/v1/appStoreVersionLocalizations/#{loc['id']}/placements?limit=50"), 'placements')['data']
    todo = creative_todo(existing, assets)
    (assets - todo).each { |a| log << "#{locale} #{a[:type]} already placed, left alone" }
    todo.each do |a|
      images[a[:path]] ||= upload_image!(lib, a, req: req, put: put, read: read, wait: wait, log: log)
      placed = ok!(*req.call('POST', '/v1/appAssetLibraryPlacements', JSON.generate(placement_body(a[:type], images[a[:path]], loc['id']))),
                   "#{locale} #{a[:type]} placement")
      log << "#{locale} #{a[:type]} placed: #{placed.dig('data', 'attributes', 'state')}"
    end
    # read back
    ok!(*req.call('GET', "/v1/appStoreVersionLocalizations/#{loc['id']}/placements?limit=50"), 'read back')['data']
      .select { |p| CREATIVE_TYPES.include?(p.dig('attributes', 'placementType')) }
      .each { |p| log << "#{locale} read back: #{p.dig('attributes', 'placementType')} #{p.dig('attributes', 'state')} #{p.dig('attributes', 'stateDetails')}" }
  end
  log
end

def upload_image!(lib, a, req:, put:, read:, wait:, log:)
  bytes = read.call(a[:path])
  res = ok!(*req.call('POST', '/v1/appAssetLibraryImages', JSON.generate(reserve_body(lib, a.merge(size: bytes.bytesize)))), "reserve #{a[:name]}")
  id = res.dig('data', 'id')
  res.dig('data', 'attributes', 'uploadOperations').each do |op|
    put.call(op, bytes.byteslice(op['offset'], op['length']))
  end
  ok!(*req.call('PATCH', "/v1/appAssetLibraryImages/#{id}",
                JSON.generate({ data: { type: 'appAssetLibraryImages', id: id, attributes: { uploaded: true } } })), "commit #{a[:name]}")
  state = nil
  60.times do
    state = ok!(*req.call('GET', "/v1/appAssetLibraryImages/#{id}"), "poll #{a[:name]}").dig('data', 'attributes', 'state')
    raise "#{a[:name]}: processing #{state}" if FAILED_STATES.include?(state)
    break unless UPLOAD_STATES.include?(state)
    wait.call(10)
  end
  raise "#{a[:name]}: still #{state} after 10 min" if UPLOAD_STATES.include?(state)
  log << "#{a[:name]} uploaded (#{bytes.bytesize} B): #{state}"
  id
end

def creative_put(op, bytes)
  uri = URI(op['url'])
  r = Net::HTTPGenericRequest.new(op['method'], true, true, uri)
  (op['requestHeaders'] || []).each { |h| r[h['name']] = h['value'] }
  r.body = bytes
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(r) }
  raise "upload slice #{op['offset']}: HTTP #{res.code}" unless res.code.start_with?('2')
end

def creative!(env, app_id, dir)
  assets = [
    { type: 'PRODUCT_PAGE_HEADER_ASSET', name: 'header-3840x1646.png' },
    { type: 'APP_STORE_SEARCH_RESULTS_ASSET', name: 'search-results-3840x2560.png' },
  ].map { |a| a.merge(path: File.join(dir, a[:name])) }
  upload_creative!(app_id, assets,
                   req: ->(m, p, b = nil) { asc_request(env, m, p, b) },
                   put: method(:creative_put), read: ->(p) { File.binread(p) }, wait: ->(s) { sleep s })
end
