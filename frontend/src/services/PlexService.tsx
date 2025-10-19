import axios from 'axios';
import { AuthPin, PlexConnection, PlexServer, PlexUser } from '@/types/plex';

const PLEX_PRODUCT_NAME = 'Plexio';
const PLEX_API_URL = 'https://plex.tv/api/v2';
const DEFAULT_LOCAL_DISCOVERY = false;

interface AuthTokenResponse {
  authToken?: string;
}

interface PlexResourceResponse {
  name?: unknown;
  sourceTitle?: unknown;
  publicAddress?: unknown;
  accessToken?: unknown;
  relay?: unknown;
  owned?: unknown;
  httpsRequired?: unknown;
  connections?: unknown;
  provides?: unknown;
}

interface PlexConnectionResponse {
  uri?: unknown;
  local?: unknown;
  relay?: unknown;
  address?: unknown;
  port?: unknown;
}

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === '1' || value.toLowerCase() === 'true') {
      return true;
    }
    if (value === '0' || value.toLowerCase() === 'false') {
      return false;
    }
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  return null;
};

const toStringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const toNumberFromUnknown = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const toPlexConnection = (
  connection: PlexConnectionResponse,
): PlexConnection | null => {
  const uri = toStringOrNull(connection.uri);
  const address = toStringOrNull(connection.address);
  const port = toNumberFromUnknown(connection.port);
  const local = toBoolean(connection.local);
  const relay = toBoolean(connection.relay);

  if (
    uri &&
    address &&
    port !== null &&
    local !== null &&
    relay !== null
  ) {
    return { uri, address, port, local, relay };
  }

  return null;
};

const toPlexServer = (resource: PlexResourceResponse): PlexServer | null => {
  if (typeof resource.provides !== 'string') {
    return null;
  }

  if (!resource.provides.includes('server')) {
    return null;
  }

  const name = toStringOrNull(resource.name);
  const sourceTitle = toStringOrNull(resource.sourceTitle);
  const publicAddress = toStringOrNull(resource.publicAddress);
  const accessToken = toStringOrNull(resource.accessToken);
  const relay = toBoolean(resource.relay);
  const owned = toBoolean(resource.owned);
  const httpsRequired = toBoolean(resource.httpsRequired);

  if (
    !name ||
    !publicAddress ||
    !accessToken ||
    relay === null ||
    owned === null ||
    httpsRequired === null
  ) {
    return null;
  }

  const connectionsRaw = Array.isArray(resource.connections)
    ? resource.connections
    : [];

  const connections = connectionsRaw
    .map((connection) =>
      toPlexConnection(connection as PlexConnectionResponse),
    )
    .filter((connection): connection is PlexConnection => connection !== null);

  return {
    name,
    sourceTitle,
    publicAddress,
    accessToken,
    relay,
    owned,
    httpsRequired,
    connections,
  };
};

export const createAuthPin = async (
  clientIdentifier: string,
): Promise<AuthPin> => {
  try {
    const response = await axios.postForm<AuthPin>(`${PLEX_API_URL}/pins`, {
      strong: 'true',
      'X-Plex-Product': PLEX_PRODUCT_NAME,
      'X-Plex-Client-Identifier': clientIdentifier,
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const getAuthToken = async (
  authPin: AuthPin,
  clientIdentifier: string,
): Promise<string> => {
  try {
    const response = await axios.get<AuthTokenResponse>(
      `${PLEX_API_URL}/pins/${authPin.id}`,
      {
        params: {
          code: authPin.code,
          'X-Plex-Client-Identifier': clientIdentifier,
        },
      },
    );

    if (typeof response.data?.authToken !== 'string') {
      throw new Error('Missing auth token in Plex response');
    }

    return response.data.authToken;
  } catch (error) {
    console.error('Error auth token:', error);
    throw error;
  }
};

export const getPlexUser = async (
  token: string,
  clientIdentifier: string,
): Promise<PlexUser | null> => {
  try {
    const response = await axios.get<PlexUser>(`${PLEX_API_URL}/user`, {
      params: {
        'X-Plex-Product': PLEX_PRODUCT_NAME,
        'X-Plex-Client-Identifier': clientIdentifier,
        'X-Plex-Token': token,
      },
    });

    if (response.status !== 200) {
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

export const getPlexServers = async (
  token: string,
  clientIdentifier: string,
): Promise<PlexServer[]> => {
  try {
    const response = await axios.get<PlexResourceResponse[]>(
      `${PLEX_API_URL}/resources`,
      {
        params: {
          includeHttps: 1,
          includeRelay: 1,
          'X-Plex-Token': token,
          'X-Plex-Client-Identifier': clientIdentifier,
        },
      },
    );

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid response from server');
    }

    const servers = response.data
      .map((resource) => toPlexServer(resource))
      .filter((server): server is PlexServer => server !== null);

    const configuredLocalDiscovery = window.env?.VITE_LOCAL_DISCOVERY;
    const localDiscovery =
      typeof configuredLocalDiscovery === 'string'
        ? configuredLocalDiscovery === 'true'
        : DEFAULT_LOCAL_DISCOVERY;

    console.debug('[PlexService] Resolved localDiscovery flag', {
      configuredValue: window.env?.VITE_LOCAL_DISCOVERY,
      localDiscovery,
    });

    if (!localDiscovery) {
      servers.forEach((server) => {
        if (server.connections.length > 0) {
          console.debug(
            '[PlexService] Filtering local connections for server',
            {
              name: server.name,
              totalConnections: server.connections.length,
            },
          );

          server.connections = server.connections.filter(
            (connection) => !connection.local,
          );

          console.debug(
            '[PlexService] Connections after local filter',
            {
              name: server.name,
              remainingConnections: server.connections.length,
            },
          );
        }
      });
    } else {
      console.debug(
        '[PlexService] Local discovery enabled; keeping all connections',
      );
    }

    return servers;
  } catch (error) {
    console.error('Error fetching Plex servers:', error);
    throw error;
  }
};
