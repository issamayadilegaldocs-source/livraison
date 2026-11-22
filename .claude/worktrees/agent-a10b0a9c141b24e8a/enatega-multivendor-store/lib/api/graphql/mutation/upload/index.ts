import { gql } from "@apollo/client";

export const UPLOAD_IMAGE_TO_S3 = gql`
  mutation UploadImageToS3($image: String!) {
    uploadImageToS3(image: $image) {
      imageUrl
    }
  }
`;

export const CREATE_CLOUDINARY_UPLOAD_SIGNATURE = gql`
  mutation CreateCloudinaryUploadSignature {
    createCloudinaryUploadSignature {
      uploadUrl
      apiKey
      timestamp
      signature
      folder
    }
  }
`;
