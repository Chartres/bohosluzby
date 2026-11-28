# ruby ios/App/fastlane/creative_test.rb
require 'minitest/autorun'
require_relative 'creative'

class CreativeTest < Minitest::Test
  HEADER = { type: 'PRODUCT_PAGE_HEADER_ASSET', path: 'h.png', name: 'header-3840x1646.png', size: 10 }
  SEARCH = { type: 'APP_STORE_SEARCH_RESULTS_ASSET', path: 's.png', name: 'search-results-3840x2560.png', size: 20 }

  def placement(type, state = 'ACTIVE')
    { 'id' => "p-#{type}", 'attributes' => { 'placementType' => type, 'placementGroup' => 'DEFAULT_PROFILE', 'state' => state } }
  end

  def test_plan_skips_a_slot_that_is_already_filled
    todo = creative_todo([placement('APP_SCREENSHOT'), placement('PRODUCT_PAGE_HEADER_ASSET')], [HEADER, SEARCH])
    assert_equal ['APP_STORE_SEARCH_RESULTS_ASSET'], todo.map { |a| a[:type] }
  end

  def test_plan_counts_screenshots_as_unrelated
    assert_equal 2, creative_todo([placement('APP_SCREENSHOT')], [HEADER, SEARCH]).size
  end

  def test_reserve_body_is_a_creative_asset_without_spec
    b = reserve_body('lib', HEADER)
    a = b[:data][:attributes]
    assert_equal 'CREATIVE_ASSETS', a[:category]
    assert_equal 'header-3840x1646.png', a[:fileName]
    assert_equal 10, a[:fileSize]
    refute a.key?(:specId)
    assert_equal({ type: 'appAssetLibraries', id: 'lib' }, b[:data][:relationships][:assetLibrary][:data])
  end

  def test_placement_body_names_image_localization_and_group
    b = placement_body('PRODUCT_PAGE_HEADER_ASSET', 'img', 'loc')
    assert_equal 'appAssetLibraryPlacements', b[:data][:type]
    assert_equal({ placementType: 'PRODUCT_PAGE_HEADER_ASSET', placementGroup: 'DEFAULT_PROFILE' }, b[:data][:attributes])
    assert_equal({ type: 'appAssetLibraryImages', id: 'img' }, b[:data][:relationships][:image][:data])
    assert_equal({ type: 'appStoreVersionLocalizations', id: 'loc' }, b[:data][:relationships][:appStoreVersionLocalization][:data])
  end

  # A fake ASC: records calls, answers like the API.
  class FakeAsc
    attr_reader :calls, :puts_done
    def initialize(existing: [], image_states: %w[UPLOAD_COMPLETE PREPARE_FOR_SUBMISSION], placement_status: '201')
      @existing = existing
      @states = Hash.new { |h, k| h[k] = image_states.dup }
      @placement_status = placement_status
      @calls = []
      @puts_done = []
      @n = 0
    end

    def req(method, path, body = nil)
      @calls << [method, path, body && JSON.parse(body)]
      case [method, path]
      in ['GET', %r{/v1/apps/app/assetLibrary$}] then ['200', { 'data' => { 'id' => 'lib' } }]
      in ['GET', %r{/v1/apps/app/appStoreVersions}] then ['200', { 'data' => [{ 'id' => 'v', 'attributes' => { 'versionString' => '1.6', 'appStoreState' => 'READY_FOR_SALE' } }] }]
      in ['GET', %r{/v1/appStoreVersions/v/appStoreVersionLocalizations}] then ['200', { 'data' => [{ 'id' => 'loc', 'attributes' => { 'locale' => 'cs' } }] }]
      in ['GET', %r{/placements}] then ['200', { 'data' => @existing }]
      in ['POST', '/v1/appAssetLibraryImages']
        @n += 1
        ['201', { 'data' => { 'id' => "img#{@n}", 'attributes' => { 'uploadOperations' => [
          { 'method' => 'PUT', 'url' => "https://up/#{@n}/0", 'offset' => 0, 'length' => 4, 'requestHeaders' => [{ 'name' => 'Content-Type', 'value' => 'image/png' }] },
          { 'method' => 'PUT', 'url' => "https://up/#{@n}/1", 'offset' => 4, 'length' => 6, 'requestHeaders' => [] },
        ] } } }]
      in ['PATCH', %r{/v1/appAssetLibraryImages/(img\d+)}] then ['200', { 'data' => { 'id' => $1 } }]
      in ['GET', %r{/v1/appAssetLibraryImages/(img\d+)}]
        ['200', { 'data' => { 'id' => $1, 'attributes' => { 'state' => @states[$1].length > 1 ? @states[$1].shift : @states[$1].first } } }]
      in ['POST', '/v1/appAssetLibraryPlacements']
        t = JSON.parse(body).dig('data', 'attributes', 'placementType')
        @placement_status == '201' ? ['201', { 'data' => { 'id' => "p-#{t}", 'attributes' => { 'placementType' => t, 'state' => 'ACTIVE' } } }] : [@placement_status, { 'errors' => [{ 'code' => 'STATE_ERROR', 'detail' => 'not editable' }] }]
      end
    end

    def put(op, bytes) = @puts_done << [op['url'], bytes, op['requestHeaders']]
  end

  def run_upload(fake, assets = [HEADER, SEARCH])
    data = { 'h.png' => '0123456789', 's.png' => 'abcdefghijklmnopqrst' }
    upload_creative!('app', assets,
                     req: fake.method(:req), put: fake.method(:put), read: ->(p) { data.fetch(p) }, wait: ->(_) {})
  end

  def test_uploads_both_in_slices_commits_and_places_on_the_cs_localization
    fake = FakeAsc.new
    lines = run_upload(fake)
    assert_equal [['https://up/1/0', '0123', [{ 'name' => 'Content-Type', 'value' => 'image/png' }]], ['https://up/1/1', '456789', []]], fake.puts_done.first(2)
    commits = fake.calls.select { |m, p, _| m == 'PATCH' }
    assert_equal [{ 'data' => { 'type' => 'appAssetLibraryImages', 'id' => 'img1', 'attributes' => { 'uploaded' => true } } }], commits.first(1).map(&:last)
    placed = fake.calls.select { |m, p, _| m == 'POST' && p == '/v1/appAssetLibraryPlacements' }.map { |c| c[2].dig('data', 'attributes', 'placementType') }
    assert_equal %w[PRODUCT_PAGE_HEADER_ASSET APP_STORE_SEARCH_RESULTS_ASSET], placed
    assert_match(/cs PRODUCT_PAGE_HEADER_ASSET placed: ACTIVE/, lines.join("\n"))
  end

  def test_places_only_after_processing_finished
    fake = FakeAsc.new
    run_upload(fake, [HEADER])
    i_place = fake.calls.index { |m, p, _| p == '/v1/appAssetLibraryPlacements' }
    last_poll = fake.calls.rindex { |m, p, _| m == 'GET' && p.start_with?('/v1/appAssetLibraryImages/img1') }
    assert last_poll < i_place
  end

  def test_nothing_uploaded_when_both_slots_are_filled
    fake = FakeAsc.new(existing: [placement('PRODUCT_PAGE_HEADER_ASSET'), placement('APP_STORE_SEARCH_RESULTS_ASSET')])
    lines = run_upload(fake)
    assert_empty fake.puts_done
    refute fake.calls.any? { |m, _, _| m == 'POST' }
    assert_match(/already placed/, lines.join("\n"))
  end

  def test_refused_placement_fails_loud
    fake = FakeAsc.new(placement_status: '409')
    err = assert_raises(RuntimeError) { run_upload(fake, [HEADER]) }
    assert_match(/409/, err.message)
    assert_match(/not editable/, err.message)
  end

  def test_failed_processing_fails_loud
    fake = FakeAsc.new(image_states: %w[UPLOAD_COMPLETE FAILED])
    err = assert_raises(RuntimeError) { run_upload(fake, [HEADER]) }
    assert_match(/FAILED/, err.message)
  end

  def test_never_submits_for_review
    fake = FakeAsc.new
    run_upload(fake)
    refute fake.calls.any? { |_, p, _| p.include?('reviewSubmission') }
  end
end
