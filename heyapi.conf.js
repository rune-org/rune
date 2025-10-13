export default {
  input: 'services/api/openapi.json',
  output: 'apps/web/src/client',
  plugins: [
    {
      name: '@hey-api/client-next',
      runtimeConfigPath: '@/hey-api', 
    },
  ],
};