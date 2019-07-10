/**
 * @author zacharyjuang
 * 2019-07-09
 */
import React from "react";
import {connect} from "react-redux";
import PropTypes from "prop-types";
import {getSungear, setQuery} from "../actions";

class QueryBody extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      dropping: false,
      value: ''
    };
  }

  handleSubmit(e) {
    e.preventDefault();
    let {value} = this.state;

    this.props.getSungear(value).then(() => {
      this.props.setQuery(value);
      this.props.history.push('/sungear');
    });
  }

  handleChange(e) {
    this.setState({
      value: e.target.value
    });
  }

  handleDrop(e) {
    e.preventDefault();
    let file;

    this.setState({dropping: false});

    if (e.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      for (let f of e.dataTransfer.items) {
        // If dropped items aren't files, reject them
        if (f.kind === 'file') {
          file = f.getAsFile();
          break;
        }
      }
    } else {
      file = e.dataTransfer.files[0];
    }

    if (file) {
      let reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = (e) => {
        this.setState({value: e.target.result});
      };
    } else {
      this.setState({value: e.dataTransfer.getData('text/plain')});
    }
  }

  handleDragOver(e) {
    e.preventDefault();
  }

  handleDragEnter(e) {
    this.setState({dropping: true});
  }

  handleDragLeave(e) {
    this.setState({dropping: false});
  }

  clear(e) {
    this.setState({
      value: ''
    });
  }

  render() {
    let {dropping} = this.state;

    return <div className="jumbotron bg-white">
      <div className="container">
        <div className="row">
          <div className="col">
            <h1 className="display-4">Sungear</h1>
            <p className="lead">Visualize Overlapping Lists!</p>
          </div>
        </div>
        <div className="row">
          <div className="col">
            <form onSubmit={this.handleSubmit.bind(this)}>
              <div className="form-group">
                <div className="input-group"
                     onDragOver={this.handleDragOver.bind(this)}
                     onDragEnter={this.handleDragEnter.bind(this)}
                     onDragLeave={this.handleDragLeave.bind(this)}
                     onDrop={this.handleDrop.bind(this)}>
                  <textarea className="form-control" placeholder="Input Lists Here"
                            rows={5}
                            onChange={this.handleChange.bind(this)}
                            value={this.state.value}
                            disabled={dropping}/>
                  <div className="input-group-append">
                    <button className="btn btn-outline-danger" onClick={this.clear.bind(this)}>Clear</button>
                    <button className="btn btn-primary" disabled={dropping}>Submit</button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>;
  }
}

QueryBody.propTypes = {
  getSungear: PropTypes.func,
  setQuery: PropTypes.func,
  history: PropTypes.object
};

const Query = connect(null, {getSungear, setQuery})(QueryBody);

export default Query;
