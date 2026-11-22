export const versions = `#graphql
query {
    getVersions {
      customerAppVersion { android ios }
      riderAppVersion { android ios }
      restaurantAppVersion { android ios }
    }
  }`;

export const getVersions = `#graphql
  query GetVersions {
    getVersions {
      customerAppVersion {
          android
          ios
      }
    }
  }
  `;
