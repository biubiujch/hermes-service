export const getEnvironmentVariable = (key: string, required?: boolean) => {
  if (required && !process.env[key]) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return process.env[key];
};
