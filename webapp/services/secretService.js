// webapp/services/secretService.js
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

/**
 * Fetches the latest enabled version of a secret from Google Cloud Secret Manager.
 * @param {string} secretName The name of the secret to fetch (e.g., "OPENAI_API_KEY").
 * @returns {Promise<string|null>} The secret value as a string, or null if an error occurs.
 */
async function getSecret(secretName) {
    // Only attempt to fetch secrets if running in a GCP environment
    if (!process.env.GCP_PROJECT) {
        // console.log(`Secret Service: Not a GCP environment (GCP_PROJECT not set). Skipping fetch for '${secretName}'.`);
        return null;
    }

    if (!secretName) {
        console.error("Secret Service: secretName parameter is missing.");
        return null;
    }

    const client = new SecretManagerServiceClient();
    const projectId = process.env.GCP_PROJECT;

    try {
        const fullName = `projects/${projectId}/secrets/${secretName}/versions/latest`;
        // console.log(`Secret Service: Attempting to access secret: ${fullName}`);

        const [version] = await client.accessSecretVersion({
            name: fullName,
        });

        const payload = version.payload.data.toString('utf8');
        // console.log(`Secret Service: Successfully fetched secret: ${secretName}`);
        return payload;
    } catch (error) {
        // Log a more specific error if the secret is not found vs. other permission errors
        if (error.code === 5) { // 5 = NOT_FOUND
            console.warn(`Secret Service: Secret '${secretName}' not found in project '${projectId}'. Ensure it exists and the service account has 'Secret Manager Secret Accessor' role.`);
        } else if (error.code === 7) { // 7 = PERMISSION_DENIED
            console.error(`Secret Service: Permission denied for secret '${secretName}' in project '${projectId}'. Ensure the service account has the 'Secret Manager Secret Accessor' role.`);
        } else {
            console.error(`Secret Service: Failed to access secret '${secretName}'. Code: ${error.code}, Message: ${error.message}`);
        }
        return null;
    }
}

/**
 * Loads multiple secrets from environment variables directly (no Secret Manager).
 * This is more cost-effective and still secure with Cloud Run.
 * @param {string[]} secretKeys - An array of secret names to check (e.g., ['OPENAI_API_KEY', 'GEMINI_API_KEY']).
 */
async function loadSecretsIntoEnv(secretKeys) {
    console.log("Secret Service: Checking environment variables...");
    for (const key of secretKeys) {
        if (process.env[key]) {
            console.log(`Secret Service: Environment variable '${key}' is available.`);
        } else {
            console.warn(`Secret Service: Environment variable '${key}' is missing. The application may not function correctly.`);
        }
    }
    console.log("Secret Service: Finished checking environment variables.");
}

module.exports = { loadSecretsIntoEnv };