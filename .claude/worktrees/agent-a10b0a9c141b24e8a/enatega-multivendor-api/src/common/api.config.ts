export interface ApiConfig {
  name: string;
  displayName: string;
  portEnv: string;
  defaultPort: number;
}

export const apiConfig: ApiConfig = {
  name: 'api',
  displayName: 'Enatega API',
  portEnv: 'API_PORT',
  defaultPort: 4000,
};
