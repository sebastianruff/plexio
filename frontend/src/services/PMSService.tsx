import axios from 'axios';
import { PlexSection, PlexSectionType } from '@/types/plex';

export const isServerAliveLocal = async (
  serverUrl: string,
  token: string,
): Promise<boolean> => {
  try {
    const response = await axios.get(serverUrl, {
      timeout: 25000,
      params: {
        'X-Plex-Token': token,
      },
    });
    return response.status === 200;
  } catch (error) {
    console.error('Error while ping PMS:', error);
    return false;
  }
};

interface PlexSectionResponse {
  key?: unknown;
  title?: unknown;
  type?: unknown;
}

const isPlexSectionType = (value: unknown): value is PlexSectionType =>
  value === 'show' || value === 'movie';

const toPlexSection = (section: PlexSectionResponse): PlexSection | null => {
  if (
    typeof section.key === 'string' &&
    typeof section.title === 'string' &&
    isPlexSectionType(section.type)
  ) {
    return {
      key: section.key,
      title: section.title,
      type: section.type,
    };
  }

  return null;
};

interface PlexSectionsApiResponse {
  MediaContainer?: {
    Directory?: PlexSectionResponse[];
  };
}

export const getSections = async (
  serverUrl: string,
  token: string,
): Promise<PlexSection[]> => {
  try {
    const response = await axios.get<PlexSectionsApiResponse>(
      `${serverUrl}/library/sections`,
      {
        timeout: 25000,
        params: {
          'X-Plex-Token': token,
        },
      },
    );

    const sections = response.data?.MediaContainer?.Directory;

    if (!Array.isArray(sections)) {
      throw new Error('Invalid response from server');
    }

    return sections
      .map((section: PlexSectionResponse) => toPlexSection(section))
      .filter((section): section is PlexSection => section !== null);
  } catch (error) {
    console.error('Error fetching Plex sections:', error);
    throw error;
  }
};
