module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.edgeloader.EdgeLoaderPackage;',
        packageInstance: 'new EdgeLoaderPackage()',
      },
      ios: {},
    },
  },
};
