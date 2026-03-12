// neurofocus.bicep — deploys all required Azure resources
// az deployment group create -g <rg> --template-file neurofocus.bicep

@description('Unique suffix for resource names')
param suffix string = uniqueString(resourceGroup().id)

@description('Azure region')
param location string = resourceGroup().location

@description('OpenAI GPT-4o model capacity (PTUs or TPM)')
param openaiCapacity int = 10

// ── Azure OpenAI ──────────────────────────────────────────────────────────//
resource openai 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'neurofocus-oai-${suffix}'
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: { publicNetworkAccess: 'Enabled' }
}

resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  parent: openai
  name: 'gpt-4o'
  sku: { name: 'Standard', capacity: openaiCapacity }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-4o', version: '2024-05-13' }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource gpt4_32kDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  parent: openai
  name: 'gpt-4-32k'
  sku: { name: 'Standard', capacity: openaiCapacity }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-4-32k', version: '0613' }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
  dependsOn: [gpt4oDeployment]
}

// ── Azure Cosmos DB (Serverless, NoSQL) ───────────────────────────────────//
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: 'neurofocus-cosmos-${suffix}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [{ name: 'EnableServerless' }]   // serverless — no provisioned RU/s
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [{ locationName: location, failoverPriority: 0 }]
    enableAutomaticFailover: false
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' = {
  parent: cosmos
  name: 'neurofocus'
  properties: { resource: { id: 'neurofocus' } }
}

resource prefsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDb
  name: 'user_preferences'
  properties: {
    resource: {
      id: 'user_preferences'
      partitionKey: { paths: ['/user_id'], kind: 'Hash' }
    }
  }
}

resource sessionsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDb
  name: 'sessions'
  properties: {
    resource: {
      id: 'sessions'
      partitionKey: { paths: ['/user_id'], kind: 'Hash' }
      defaultTtl: 7776000   // 90 days auto-expiry
    }
  }
}

// ── Azure App Service (FastAPI backend) ───────────────────────────────────//
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'neurofocus-plan-${suffix}'
  location: location
  sku: { name: 'B2', tier: 'Basic' }
  kind: 'linux'
  properties: { reserved: true }
}

resource backendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'neurofocus-api-${suffix}'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appCommandLine: 'uvicorn main:app --host 0.0.0.0 --port 8000'
      appSettings: [
        { name: 'AZURE_OPENAI_ENDPOINT', value: openai.properties.endpoint }
        { name: 'AZURE_OPENAI_API_KEY', value: openai.listKeys().key1 }
        { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
        { name: 'COSMOS_KEY', value: cosmos.listKeys().primaryMasterKey }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: '1' }
      ]
    }
  }
}

// ── Azure Static Web Apps (React frontend) ────────────────────────────────//
resource swa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'neurofocus-swa-${suffix}'
  location: location
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {
    buildProperties: {
      appLocation: 'frontend'
      outputLocation: 'dist'
      appBuildCommand: 'npm run build'
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────//
output openaiEndpoint string = openai.properties.endpoint
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output backendUrl string = 'https://${backendApp.properties.defaultHostName}'
output frontendUrl string = 'https://${swa.properties.defaultHostname}'
