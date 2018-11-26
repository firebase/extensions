import { expect } from 'chai';
import { suite, test, slow, timeout } from "mocha-typescript";

import { WorkerShardingInfo, ShardedCounterController } from "../src/controller";

@suite class ControllerTest extends ShardedCounterController {
  @test 'can reshard workers'() {
    const workers: WorkerShardingInfo[] = [{
      slice: {
        start: '00000000',
        end: '33333333'
      },
      hasData: true,
      overloaded: false,
      splits: ['11111111', '22222222']
    }, {
      slice: {
        start: '3333333',
        end: '66666666'
      },
      hasData: true,
      overloaded: false,
      splits: ['44444444', '55555555']
    }];
    const [reshard, slices] = ControllerTest.balanceWorkers(workers, 1);
    expect(reshard).to.be.equal(true);
    expect(slices).to.deep.equal([{ start: '00000000', end: '66666666' }])
  }
}