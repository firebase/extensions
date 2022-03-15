const { ProjectsClient } = require("@google-cloud/resource-manager");

/* TODO: searchProjectsAsync sometimes returns {}.
 * Could be resource intensive, if checked on every records insert.
 */
export const validateProject = async (id: string): Promise<boolean> => {
  let isValid = false;

  const client = new ProjectsClient();
  const projects = client.searchProjectsAsync();

  for await (const project of projects) {
    if (project.projectId === id) {
      isValid = true;
    }
  }

  return isValid;
};
