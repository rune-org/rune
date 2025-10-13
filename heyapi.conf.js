export default {
  input: 'services/api/openapi.json', // sign up at app.heyapi.dev
  output: 'apps/web/src/client',
  plugins: [
    {
      name: '@hey-api/client-next',
      runtimeConfigPath: '@/hey-api', 
    },
  ],
};