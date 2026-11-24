# ruby ios/App/fastlane/tour_test.rb
require 'minitest/autorun'
require_relative 'tour'

class TourTest < Minitest::Test
  V = { 'id' => 'v', 'attributes' => { 'versionString' => '1.6', 'appStoreState' => 'PREPARE_FOR_SUBMISSION', 'releaseType' => 'MANUAL' } }
  B = { 'attributes' => { 'version' => '96', 'processingState' => 'VALID' } }
  L = { 'id' => 'l', 'attributes' => { 'locale' => 'cs', 'description' => 'Popis', 'whatsNew' => 'Novinky' } }

  def report(**over)
    tour_report(**{ version: V, build: B, version_build: B, locs: [L], shot_counts: { 'l' => 5 }, review_detail: { 'id' => 'r' } }.merge(over))
  end

  def test_ready
    lines, blockers = report
    assert_empty blockers
    assert_includes lines.join("\n"), 'release type MANUAL'
    assert_includes lines.join("\n"), 'attached build: 96'
  end

  def test_build_still_processing_blocks
    _, blockers = report(build: { 'attributes' => { 'version' => '96', 'processingState' => 'PROCESSING' } })
    assert_includes blockers, 'build 96 is PROCESSING'
  end

  def test_missing_screenshots_description_review_block
    _, blockers = report(locs: [{ 'id' => 'l', 'attributes' => { 'locale' => 'cs', 'description' => '', 'whatsNew' => '' } }], shot_counts: {}, review_detail: nil)
    assert_includes blockers, 'cs: no description'
    assert_includes blockers, 'cs: no screenshots'
    assert_includes blockers, 'review details missing'
  end

  def test_empty_release_notes_warn_only
    lines, blockers = report(locs: [{ 'id' => 'l', 'attributes' => { 'locale' => 'cs', 'description' => 'x', 'whatsNew' => '' } }])
    assert_empty blockers
    assert_match(/no release notes yet/, lines.join("\n"))
  end

  def test_no_version_yet
    _, blockers = report(version: nil)
    assert_equal ['version missing'], blockers
  end
end
