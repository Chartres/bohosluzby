# Generic ASC API caller using stdlib only.
# usage: ruby asc_api.rb <.env> <METHOD> <path> [json_body]
#
# Also requirable as a library (screenshot_ops.rb does this) — the CLI bits
# below only run when this file is executed directly, not on require.
require 'openssl'; require 'base64'; require 'json'; require 'net/http'

def asc_load_env(envfile)
  env = {}
  File.readlines(envfile).each do |l|
    next if l.strip.empty? || l.strip.start_with?('#')
    k, v = l.strip.split('=', 2); env[k] = v
  end
  env
end

# Returns [http_code_string, parsed_json_or_raw_body]
def asc_request(env, method, path, bodyarg = nil)
  kid = env['ASC_KEY_ID']; iss = env['ASC_ISSUER_ID']
  p8 = File.expand_path("~/.appstoreconnect/private_keys/AuthKey_#{kid}.p8")
  key = OpenSSL::PKey::EC.new(File.read(p8))
  b64 = ->(h) { Base64.urlsafe_encode64(JSON.dump(h), padding: false) }
  now = Time.now.to_i
  input = "#{b64.call({ alg: 'ES256', kid: kid, typ: 'JWT' })}.#{b64.call({ iss: iss, iat: now, exp: now + 300, aud: 'appstoreconnect-v1' })}"
  der = key.sign(OpenSSL::Digest::SHA256.new, input)
  a = OpenSSL::ASN1.decode(der)
  r = a.value[0].value.to_s(2).rjust(32, "\x00"); s = a.value[1].value.to_s(2).rjust(32, "\x00")
  jwt = "#{input}.#{Base64.urlsafe_encode64(r + s, padding: false)}"

  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  klass = { 'GET' => Net::HTTP::Get, 'POST' => Net::HTTP::Post, 'PATCH' => Net::HTTP::Patch, 'DELETE' => Net::HTTP::Delete }[method]
  req = klass.new(uri)
  req['Authorization'] = "Bearer #{jwt}"
  if bodyarg
    req['Content-Type'] = 'application/json'
    req.body = bodyarg
  end
  res = Net::HTTP.start(uri.host, 443, use_ssl: true) { |h| h.request(req) }
  [res.code, (JSON.parse(res.body) rescue res.body)]
end

if __FILE__ == $0
  envfile, method, path, bodyarg = ARGV
  code, body = asc_request(asc_load_env(envfile), method, path, bodyarg)
  puts "HTTP #{code}"
  puts body.is_a?(String) ? body : JSON.pretty_generate(body)
end
