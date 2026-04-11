const { withEntitlementsPlist } = require('@expo/config-plugins');

function withNetworkExtensionEntitlements(config) {
  return withEntitlementsPlist(config, async (config) => {
    // 1. Add Network Extension Entitlement so we can be a Proxy Provider
    config.modResults['com.apple.developer.networking.networkextension'] = [
      'app-proxy-provider'
    ];

    // 2. Setup the App Group so the extension can write data back to the main app
    const appGroup = 'group.com.celsave.network';
    const groups = config.modResults['com.apple.security.application-groups'] || [];
    if (!groups.includes(appGroup)) {
      groups.push(appGroup);
    }
    config.modResults['com.apple.security.application-groups'] = groups;

    return config;
  });
}

module.exports = withNetworkExtensionEntitlements;
