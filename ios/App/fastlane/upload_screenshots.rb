# Direct ASC screenshot upload (reserve -> PUT bytes -> commit). Used when
# deliver refuses the version state (READY_FOR_REVIEW is editable but deliver
# only recognizes PREPARE_FOR_SUBMISSION). Reads asc_api.rb for auth + JSON.
# usage: ruby upload_screenshots.rb <.env> <setId=localGlobPrefix> ...
#   e.g. ruby upload_screenshots.rb .env 00c8..=ipad-13 badb..=iphone-6.9
require 'openssl'; require 'base64'; require 'json'; require 'net/http'; require 'digest'
require_relative 'asc_api'

env = asc_load_env(ARGV[0])
pairs = ARGV[1..].map { |a| a.split('=', 2) }
dir = File.expand_path('screenshots/cs', __dir__)

pairs.each do |set_id, prefix|
  files = Dir.glob(File.join(dir, "#{prefix}-*.png")).sort
  abort "no files for #{prefix}" if files.empty?
  files.each do |path|
    name = File.basename(path)
    bytes = File.binread(path)
    # 1) reserve
    _, shot = asc_request(env, 'POST', '/v1/appScreenshots', JSON.dump(
      data: { type: 'appScreenshots',
              attributes: { fileSize: bytes.bytesize, fileName: name },
              relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set_id } } } }))
    id = shot.dig('data', 'id')
    ops = shot.dig('data', 'attributes', 'uploadOperations') || []
    # 2) PUT bytes per operation
    ops.each do |op|
      uri = URI(op['url'])
      req = Net::HTTP::Put.new(uri)
      (op['requestHeaders'] || []).each { |h| req[h['name']] = h['value'] }
      req.body = bytes.byteslice(op['offset'], op['length'])
      r = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') { |h| h.request(req) }
      abort "PUT failed #{name}: #{r.code}" unless r.code.to_i.between?(200, 299)
    end
    # 3) commit with md5
    md5 = Digest::MD5.hexdigest(bytes)
    code, = asc_request(env, 'PATCH', "/v1/appScreenshots/#{id}", JSON.dump(
      data: { type: 'appScreenshots', id: id, attributes: { uploaded: true, sourceFileChecksum: md5 } }))
    puts "uploaded #{name} -> #{id} (commit #{code})"
  end
end
