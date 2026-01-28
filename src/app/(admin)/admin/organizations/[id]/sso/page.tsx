'use client';

import { useState, useEffect, useCallback } from 'react';
import { use } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  AlertCard,
  Textarea,
} from '@/components/ui';
import {
  Shield,
  Check,
  X,
  Copy,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface SSOConfig {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  plan: string;
  ssoEnabled: boolean;
  ssoProvider: string | null;
  ssoConfig: Record<string, unknown> | null;
  samlMetadata?: {
    spMetadataUrl: string;
    acsUrl: string;
  };
}

const SSO_PROVIDERS = [
  {
    id: 'saml',
    name: 'SAML 2.0',
    description: 'Enterprise SSO with SAML 2.0',
    icon: '🔐',
    requiresEnterprise: true,
  },
  {
    id: 'oauth-google',
    name: 'Google OAuth',
    description: 'Sign in with Google Workspace',
    icon: '🔵',
    requiresEnterprise: false,
  },
  {
    id: 'oauth-github',
    name: 'GitHub OAuth',
    description: 'Sign in with GitHub',
    icon: '⚫',
    requiresEnterprise: false,
  },
  {
    id: 'oauth-azure',
    name: 'Azure AD OAuth',
    description: 'Sign in with Microsoft Azure AD',
    icon: '🔷',
    requiresEnterprise: true,
  },
];

export default function OrganizationSSOPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const organizationId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<SSOConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [configData, setConfigData] = useState<Record<string, unknown>>({});

  const getConfigString = (key: string) => {
    const value = configData[key];
    return typeof value === 'string' ? value : '';
  };

  const getConfigBoolean = (key: string, fallback: boolean) => {
    const value = configData[key];
    return typeof value === 'boolean' ? value : fallback;
  };

  const fetchSSOConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/sso`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data.data);
        setEnabled(data.data.ssoEnabled);
        setSelectedProvider(data.data.ssoProvider || '');
        setConfigData(data.data.ssoConfig || {});
      } else {
        const error = await res.json();
        toast.error('Failed to load SSO configuration', {
          description: error.error,
        });
      }
    } catch (error) {
      console.error('Error fetching SSO config:', error);
      toast.error('Failed to load SSO configuration');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchSSOConfig();
  }, [fetchSSOConfig]);

  const handleSave = async (testFirst = false) => {
    if (testFirst) {
      setTesting(true);
    } else {
      setSaving(true);
    }

    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/sso`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          provider: selectedProvider || undefined,
          config: Object.keys(configData).length > 0 ? configData : undefined,
          testConnection: testFirst,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(testFirst ? 'SSO connection test successful' : 'SSO configuration saved', {
          description: testFirst ? 'Configuration is valid' : 'Changes have been applied',
        });
        if (!testFirst) {
          fetchSSOConfig(); // Refresh
        }
      } else {
        toast.error(testFirst ? 'SSO connection test failed' : 'Failed to save SSO configuration', {
          description: data.error || data.details,
        });
      }
    } catch (error) {
      console.error('Error saving SSO config:', error);
      toast.error('Failed to save SSO configuration');
    } finally {
      setSaving(false);
      setTesting(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm('Are you sure you want to disable and remove SSO configuration?')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/sso`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('SSO configuration removed');
        fetchSSOConfig();
      } else {
        const error = await res.json();
        toast.error('Failed to remove SSO configuration', {
          description: error.error,
        });
      }
    } catch (error) {
      console.error('Error removing SSO config:', error);
      toast.error('Failed to remove SSO configuration');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const providerMetadata = SSO_PROVIDERS.find(p => p.id === selectedProvider);
  const requiresEnterprise = providerMetadata?.requiresEnterprise || false;
  const canUseProvider = !requiresEnterprise || config?.plan === 'enterprise';

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-8 text-center">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              SSO Configuration
            </h1>
            <p className="text-muted-foreground">
              Configure single sign-on for {config?.organizationName}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {config?.ssoEnabled && (
              <Button variant="outline" onClick={handleDisable}>
                <Trash2 className="h-4 w-4 mr-2" />
                Disable SSO
              </Button>
            )}
            <Button onClick={() => handleSave(true)} disabled={testing || !selectedProvider}>
              <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
              Test Connection
            </Button>
            <Button onClick={() => handleSave(false)} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Status */}
        <AlertCard variant={enabled ? 'success' : 'warning'}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {enabled ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <X className="h-5 w-5 text-yellow-600" />
              )}
              <span className="font-medium">
                SSO is {enabled ? 'enabled' : 'disabled'} for this organization
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Enable SSO</span>
            </label>
          </div>
        </AlertCard>

        {/* Provider Selection */}
        <Card>
          <CardHeader>
            <CardTitle>SSO Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SSO_PROVIDERS.map(provider => (
                <div
                  key={provider.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedProvider === provider.id
                      ? 'border-accent ring-2 ring-accent'
                      : 'hover:border-gray-400'
                  } ${
                    provider.requiresEnterprise && config?.plan !== 'enterprise'
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                  onClick={() => {
                    if (!provider.requiresEnterprise || config?.plan === 'enterprise') {
                      setSelectedProvider(provider.id);
                      // Reset config when changing provider
                      setConfigData({});
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{provider.icon}</span>
                      <h3 className="font-semibold">{provider.name}</h3>
                    </div>
                    {selectedProvider === provider.id && (
                      <Check className="h-5 w-5 text-accent" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{provider.description}</p>
                  {provider.requiresEnterprise && (
                    <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                      <Shield className="h-3 w-3" />
                      Enterprise only
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Configuration */}
        {selectedProvider && (
          <>
            {!canUseProvider && (
              <AlertCard variant="warning">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>
                    This provider requires an enterprise plan. Please upgrade to use{' '}
                    {providerMetadata?.name}.
                  </span>
                </div>
              </AlertCard>
            )}

            {selectedProvider === 'saml' && (
              <Card>
                <CardHeader>
                  <CardTitle>SAML 2.0 Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Service Provider Info */}
                  {config?.samlMetadata && (
                    <div className="bg-muted p-4 rounded-lg space-y-3">
                      <h4 className="font-semibold text-sm">Service Provider Metadata</h4>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-muted-foreground">ACS URL</label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              value={config.samlMetadata.acsUrl}
                              readOnly
                              className="bg-white"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(config.samlMetadata!.acsUrl, 'ACS URL')
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            Metadata URL
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              value={config.samlMetadata.spMetadataUrl}
                              readOnly
                              className="bg-white"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(
                                  config.samlMetadata!.spMetadataUrl,
                                  'Metadata URL'
                                )
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Identity Provider Config */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Entity ID *</label>
                    <Input
                      value={getConfigString('entityId')}
                      onChange={e => setConfigData({ ...configData, entityId: e.target.value })}
                      placeholder="https://idp.example.com/metadata"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">SSO URL *</label>
                    <Input
                      value={getConfigString('ssoUrl')}
                      onChange={e => setConfigData({ ...configData, ssoUrl: e.target.value })}
                      placeholder="https://idp.example.com/sso"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">X.509 Certificate *</label>
                    <Textarea
                      value={getConfigString('certificate')}
                      onChange={e =>
                        setConfigData({ ...configData, certificate: e.target.value })
                      }
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      rows={6}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Paste the IdP&apos;s X.509 certificate in PEM format
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="signRequests"
                      checked={getConfigBoolean('signRequests', true)}
                      onChange={e =>
                        setConfigData({ ...configData, signRequests: e.target.checked })
                      }
                    />
                    <label htmlFor="signRequests" className="text-sm cursor-pointer">
                      Sign authentication requests
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedProvider.startsWith('oauth-') && (
              <Card>
                <CardHeader>
                  <CardTitle>OAuth 2.0 Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Client ID *</label>
                    <Input
                      value={getConfigString('clientId')}
                      onChange={e => setConfigData({ ...configData, clientId: e.target.value })}
                      placeholder="your-client-id"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Client Secret *</label>
                    <Input
                      type="password"
                      value={getConfigString('clientSecret')}
                      onChange={e =>
                        setConfigData({ ...configData, clientSecret: e.target.value })
                      }
                      placeholder="your-client-secret"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Will be encrypted before storage
                    </p>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Provider Endpoints</h4>
                    <p className="text-xs text-muted-foreground">
                      Using default {providerMetadata?.name} endpoints. These can be customized if
                      needed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Select your SSO provider from the options above</li>
                <li>Configure the provider in your identity management system (Okta, Azure AD, etc.)</li>
                {selectedProvider === 'saml' && (
                  <>
                    <li>Copy the ACS URL and Metadata URL to your IdP configuration</li>
                    <li>Paste your IdP&apos;s metadata (Entity ID, SSO URL, Certificate) into the form above</li>
                  </>
                )}
                {selectedProvider?.startsWith('oauth-') && (
                  <>
                    <li>Create an OAuth application in your provider&apos;s developer console</li>
                    <li>Copy the Client ID and Client Secret to the form above</li>
                  </>
                )}
                <li>Test the connection to verify the configuration</li>
                <li>Enable SSO to allow users to sign in via your identity provider</li>
              </ol>
            </div>

            {selectedProvider && providerMetadata && (
              <div className="flex items-center gap-2 pt-2">
                <ExternalLink className="h-4 w-4" />
                <a
                  href={`https://docs.example.com/sso/${selectedProvider}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:underline"
                >
                  View detailed setup guide for {providerMetadata.name}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
