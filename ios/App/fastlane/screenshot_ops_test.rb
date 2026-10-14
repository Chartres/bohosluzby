# Self-check for the pure parts of screenshot_ops.rb (no network).
# run: ruby ios/App/fastlane/screenshot_ops_test.rb
require 'tmpdir'
require_relative 'screenshot_ops'

def check(name, cond) = (cond ? puts("ok   #{name}") : abort("FAIL #{name}"))

Dir.mktmpdir do |dir|
  a = File.join(dir, 'iphone-6.9-1-map.png'); File.write(a, 'new pixels')
  b = File.join(dir, 'iphone-6.9-2-home.png'); File.write(b, 'home')
  md5 = ->(p) { Digest::MD5.file(p).hexdigest }
  shot = ->(file, sum) { { 'attributes' => { 'fileName' => file, 'sourceFileChecksum' => sum } } }

  check 'same names + same MD5 → match',
        screenshot_set_matches?([a, b], [shot['iphone-6.9-2-home.png', md5[b]], shot['iphone-6.9-1-map.png', md5[a]]])
  # v1.3 miss: ASC copied 1.2's shots forward — same names, old pixels.
  check 'same names, different content → no match',
        !screenshot_set_matches?([a, b], [shot['iphone-6.9-1-map.png', 'old'], shot['iphone-6.9-2-home.png', md5[b]]])
  # Shots ASC copies into a new version carry no checksum at all.
  check 'missing remote checksum → no match',
        !screenshot_set_matches?([a, b], [shot['iphone-6.9-1-map.png', nil], shot['iphone-6.9-2-home.png', nil]])
  check 'duplicate remote shot → no match',
        !screenshot_set_matches?([a], [shot['iphone-6.9-1-map.png', md5[a]], shot['iphone-6.9-1-map.png', md5[a]]])
end
