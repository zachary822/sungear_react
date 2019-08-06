/**
 * @author zacharyjuang
 * 2019-07-23
 */
import React from "react";

class Test extends React.Component {
  onSubmit(e) {
    e.preventDefault();
    fetch('/sungear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: '{"value":">a\\n1\\n>b\\n1\\n2\\n3"}'
    })
      .then(() => {
        window.location.href = '/sungear';
      });
  }

  render() {
    return <form onSubmit={this.onSubmit.bind(this)}>
      <button type="submit" className="btn btn-primary">Submit</button>
    </form>;
  }
}

export default Test;
