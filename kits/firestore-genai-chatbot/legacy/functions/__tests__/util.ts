import { Timestamp } from "firebase-admin/firestore";

export const expectToProcessCorrectly = (
  firestoreCallData: any[],
  message: any,
  _addCreateTime = true,
  mockResponse = "test response"
) => {
  expect(firestoreCallData[0]).toEqual({
    ...message,
  });

  expect(firestoreCallData[1]).toEqual({
    ...message,
    createTime: expect.any(Timestamp),
    status: {
      state: "PROCESSING",
      startTime: expect.any(Timestamp),
      updateTime: expect.any(Timestamp),
    },
  });

  expect(firestoreCallData[1].status.startTime).toEqual(
    firestoreCallData[1].status.updateTime
  );

  expect(firestoreCallData[2]).toEqual({
    ...message,
    response: mockResponse,
    candidates: expect.any(Array),
    createTime: expect.any(Timestamp),
    status: {
      state: "COMPLETED",
      startTime: expect.any(Timestamp),
      updateTime: expect.any(Timestamp),
      completeTime: expect.any(Timestamp),
    },
  });

  expect(firestoreCallData[2].status.startTime).toEqual(
    firestoreCallData[1].status.startTime
  );

  expect(firestoreCallData[2].status.updateTime).toEqual(
    firestoreCallData[2].status.completeTime
  );
};
