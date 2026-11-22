import { gql } from "@apollo/client";

const RESTAURANT_CATALOG_FRAGMENT = `
  _id
  categories {
    _id
    title
    description
    foods {
      _id
      title
      description
      image
      isOutOfStock
      variations {
        _id
        title
        price
        discounted
      }
    }
  }
`;

export const STOR_CREATE_CATEGORY = gql`
  mutation StorCreateCategory($category: CategoryInput!) {
    storCreateCategory(category: $category) {
      ${RESTAURANT_CATALOG_FRAGMENT}
    }
  }
`;

export const STOR_EDIT_CATEGORY = gql`
  mutation StorEditCategory($category: CategoryInput!) {
    storEditCategory(category: $category) {
      ${RESTAURANT_CATALOG_FRAGMENT}
    }
  }
`;

export const STOR_DELETE_CATEGORY = gql`
  mutation StorDeleteCategory($id: ID!) {
    storDeleteCategory(id: $id) {
      ${RESTAURANT_CATALOG_FRAGMENT}
    }
  }
`;

export const STOR_CREATE_FOOD = gql`
  mutation StorCreateFood($food: FoodInput!) {
    storCreateFood(food: $food) {
      ${RESTAURANT_CATALOG_FRAGMENT}
    }
  }
`;

export const STOR_EDIT_FOOD = gql`
  mutation StorEditFood($food: FoodInput!) {
    storEditFood(food: $food) {
      ${RESTAURANT_CATALOG_FRAGMENT}
    }
  }
`;

export const STOR_DELETE_FOOD = gql`
  mutation StorDeleteFood($id: ID!, $categoryId: ID!) {
    storDeleteFood(id: $id, categoryId: $categoryId) {
      ${RESTAURANT_CATALOG_FRAGMENT}
    }
  }
`;

export const STOR_UPDATE_FOOD_OUT_OF_STOCK = gql`
  mutation StorUpdateFoodOutOfStock($id: ID!, $categoryId: ID!) {
    storUpdateFoodOutOfStock(id: $id, categoryId: $categoryId)
  }
`;

const ADDON_OPTION_FRAGMENT = `
  _id
  options { _id title description price }
  addons { _id title description quantityMinimum quantityMaximum options }
`;

export const STOR_CREATE_OPTIONS = gql`
  mutation StorCreateOptions($options: CreateOptionInput!) {
    storCreateOptions(options: $options) {
      ${ADDON_OPTION_FRAGMENT}
    }
  }
`;

export const STOR_EDIT_OPTION = gql`
  mutation StorEditOption($option: editOptionInput!) {
    storEditOption(option: $option) {
      ${ADDON_OPTION_FRAGMENT}
    }
  }
`;

export const STOR_DELETE_OPTION = gql`
  mutation StorDeleteOption($id: ID!) {
    storDeleteOption(id: $id) {
      ${ADDON_OPTION_FRAGMENT}
    }
  }
`;

export const STOR_CREATE_ADDONS = gql`
  mutation StorCreateAddons($addons: AddonInput!) {
    storCreateAddons(addons: $addons) {
      ${ADDON_OPTION_FRAGMENT}
    }
  }
`;

export const STOR_EDIT_ADDON = gql`
  mutation StorEditAddon($addons: editAddonInput!) {
    storEditAddon(addons: $addons) {
      ${ADDON_OPTION_FRAGMENT}
    }
  }
`;

export const STOR_DELETE_ADDON = gql`
  mutation StorDeleteAddon($id: ID!) {
    storDeleteAddon(id: $id) {
      ${ADDON_OPTION_FRAGMENT}
    }
  }
`;
