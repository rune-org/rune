export default {
  input: 'services/api/openapi.yaml',
  output: 'apps/web/src/client',
  plugins: [
    {
      name: '@hey-api/client-next',
      runtimeConfigPath: '@/hey-api', 
    },
  ],
};
