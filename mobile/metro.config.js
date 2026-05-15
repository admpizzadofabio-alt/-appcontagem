const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Adiciona .lottie como asset (dotLottie format)
config.resolver.assetExts.push('lottie')

module.exports = config
