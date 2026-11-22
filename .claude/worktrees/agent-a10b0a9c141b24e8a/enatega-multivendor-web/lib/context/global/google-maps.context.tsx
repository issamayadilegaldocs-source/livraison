"use client";

// Core
import React, { createContext, useContext } from "react";

// Third-party libraries
import { useJsApiLoader } from "@react-google-maps/api";

// Interfaces
import {
  IGoogleMapsContext,
  IGoogleMapsProviderProps,
} from "../../utils/interfaces";

export const GoogleMapsContext = createContext<IGoogleMapsContext>(
  {} as IGoogleMapsContext
);

export const GoogleMapsProvider: React.FC<IGoogleMapsProviderProps> = ({
  apiKey,
  libraries,
  children,
}) => {
  // useJsApiLoader manages script injection; the manual script tag below it was
  // redundant and caused a double-load + unload on every apiKey change.
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });

  const value: IGoogleMapsContext = {
    isLoaded,
  };

  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
    </GoogleMapsContext.Provider>
  );
};
