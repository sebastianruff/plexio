import axios from 'axios';

interface TestConnectionResponse {
  success?: boolean;
}

export const isServerAliveRemote = async (
  serverUrl: string,
  token: string,
): Promise<boolean> => {
  try {
    const response = await axios.get<TestConnectionResponse>(
      `${window.location.origin}/api/v1/test-connection`,
      {
        timeout: 25000,
        params: {
          url: serverUrl,
          token,
        },
      },
    );
    return response.data?.success === true;
  } catch (error) {
    console.error('Error while ping PMS remote:', error);
    return false;
  }
};
