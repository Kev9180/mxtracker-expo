const fs = require('fs')
const path = require('path')
const { expo } = require('./app.json')

const defaultGoogleServicesFile = path.resolve(__dirname, 'google-services.json')
const googleServicesFileFromEnv = process.env.GOOGLE_SERVICES_JSON
const resolvedGoogleServicesFile = googleServicesFileFromEnv || (
  fs.existsSync(defaultGoogleServicesFile) ? defaultGoogleServicesFile : undefined
)

const { android = {}, ...restExpo } = expo
const { googleServicesFile: _ignoredGoogleServicesFile, ...restAndroid } = android

module.exports = {
  expo: {
    ...restExpo,
    android: {
      ...restAndroid,
      ...(resolvedGoogleServicesFile ? { googleServicesFile: resolvedGoogleServicesFile } : {}),
    },
  },
}