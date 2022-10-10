import { getDatabaseUrl } from "../src/helpers";

describe("Test Realtime Database URL helper function", () => {
  test("Can return the correct url for us-central-1", () => {
    const environment = {
      SELECTED_DATABASE_INSTANCE: "server-name",
      SELECTED_DATABASE_LOCATION: "us-central1",
    };

    const serverUrl = getDatabaseUrl(
      environment.SELECTED_DATABASE_INSTANCE,
      environment.SELECTED_DATABASE_LOCATION
    );
    expect(serverUrl).toBe(
      `https://${environment.SELECTED_DATABASE_INSTANCE}.firebaseio.com`
    );
  });

  test("Can return the correct url for europe-west1", () => {
    const environment = {
      SELECTED_DATABASE_INSTANCE: "server-name",
      SELECTED_DATABASE_LOCATION: "europe-west1",
    };

    const serverUrl = getDatabaseUrl(
      environment.SELECTED_DATABASE_INSTANCE,
      environment.SELECTED_DATABASE_LOCATION
    );
    expect(serverUrl).toBe(
      `https://${environment.SELECTED_DATABASE_INSTANCE}.europe-west1.firebasedatabase.app`
    );
  });

  test("Can return the correct url for asia-southeast1", () => {
    const environment = {
      SELECTED_DATABASE_INSTANCE: "server-name",
      SELECTED_DATABASE_LOCATION: "asia-southeast1",
    };

    const serverUrl = getDatabaseUrl(
      environment.SELECTED_DATABASE_INSTANCE,
      environment.SELECTED_DATABASE_LOCATION
    );
    expect(serverUrl).toBe(
      `https://${environment.SELECTED_DATABASE_INSTANCE}.asia-southeast1.firebasedatabase.app`
    );
  });

  test("Return null if instance is undefined", () => {
    const environment = {
      SELECTED_DATABASE_INSTANCE: undefined,
      SELECTED_DATABASE_LOCATION: "asia-southeast1",
    };

    const serverUrl = getDatabaseUrl(
      environment.SELECTED_DATABASE_INSTANCE,
      environment.SELECTED_DATABASE_LOCATION
    );
    expect(serverUrl).toBe(null);
  });

  test("Return null if location is undefined", () => {
    const environment = {
      SELECTED_DATABASE_INSTANCE: "server-name",
      SELECTED_DATABASE_LOCATION: undefined,
    };

    const serverUrl = getDatabaseUrl(
      environment.SELECTED_DATABASE_INSTANCE,
      environment.SELECTED_DATABASE_LOCATION
    );
    expect(serverUrl).toBe(null);
  });
});
