class TaskQueue {
  /**
   * 任务队列
   * @param tasks 请求数组
   * @param maxNum 最大并发数
   * @param callTime 错误重发次数
   * @param callback 回调
   */
  constructor(tasks, maxNum, callTime, callback) {
    this.maxNum = maxNum;
    this.running = 0;
    this.queue = tasks;
    this.results = [];
    this.callback = callback;
    this.next();
    this.callTime = callTime;
  }
  next() {
    while (this.running < this.maxNum && this.queue.length) {
      console.log('running');
      const task = this.queue.shift();
      let count = 0;
      const run = async task => {
        try {
          const res = await task(task);
          console.log('success push');
          this.results.push(res);
          this.running--;
          this.next();
        } catch (e) {
          console.log('trying');
          count += 1;
          if (count >= this.callTime) {
            console.log('fail push');
            this.results.push(e);
            this.running--;
            this.next();
          } else {
            run(task);
          }
        }
      };
      run.call(this, task);
      this.running++;
    }

    if (typeof this.callback === 'function' && this.running == 0) {
      this.callback.call(null, this.results);
    }
  }
}

module.exports = TaskQueue