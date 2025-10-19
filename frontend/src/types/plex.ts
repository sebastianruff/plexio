export interface AuthPin {
  id: string;
  code: string;
}

export interface PlexUser {
  username: string;
  thumb: string;
}

export interface PlexConnection {
  uri: string;
  local: boolean;
  relay: boolean;
  address: string;
  port: number;
}

export interface PlexServer {
  name: string;
  sourceTitle: string | null;
  publicAddress: string;
  accessToken: string;
  relay: boolean;
  owned: boolean;
  httpsRequired: boolean;
  connections: PlexConnection[];
}

export type PlexSectionType = 'show' | 'movie';

export interface PlexSection {
  key: string;
  title: string;
  type: PlexSectionType;
}
