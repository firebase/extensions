import config from './config';

export const error = (err: Error) => {
  console.error('Error executing mod: ', err);
};

export const start = () => {
  console.log('Started mod execution with config \n', config);
};

export const handleWrite = (uuid: string, clientId: string, status: string) => {
  console.log(`Detected ${status} with (user: ${uuid}, client: ${clientId})`);
};

export const handleUpsert = (path: string, payload: string) => {
  console.log(`Upserting data: ${payload} at path: ${path}`);
};

export const handleDelete = (path: string) => {
  console.log(`Deleting data at path: ${path}`);
};

export const success = () => {
  console.log("Information successfully written to Firestore.");
};