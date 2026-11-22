import { gql } from "@apollo/client";

export const getZones = `#graphql
query Zones{
  zones{
  _id
  title
  description
  location{coordinates}
  isActive
  }
}`;

export const GET_ZONE_BY_POINT = gql`
  query ZoneByPoint($latitude: Float!, $longitude: Float!) {
    zoneByPoint(latitude: $latitude, longitude: $longitude) {
      _id
      title
    }
  }
`;

export const GET_ZONE_BY_ID = gql`
  query ZoneById($id: String!) {
    zoneById(id: $id) {
      _id
      title
      description
      isActive
      location {
        coordinates
      }
    }
  }
`;
