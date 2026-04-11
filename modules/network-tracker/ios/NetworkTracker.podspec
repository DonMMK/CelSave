require 'json'

Pod::Spec.new do |s|
  # We reuse package.json properties for the podspec
  package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

  s.name           = 'NetworkTracker'
  s.version        = package['version']
  s.summary        = package['description'] || 'NetworkTracker'
  s.description    = package['description'] || 'NetworkTracker'
  s.license        = package['license'] || 'MIT'
  s.author         = package['author'] || ''
  s.homepage       = package['homepage'] || 'https://github.com/expo/expo'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.source_files = "**/*.{h,m,swift}"
end
