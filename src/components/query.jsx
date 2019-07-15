/**
 * @author zacharyjuang
 * 2019-07-09
 */
import React from "react";
import {connect} from "react-redux";
import PropTypes from "prop-types";
import {getSungear, setQuery} from "../actions";
import classNames from "classnames";
import fileUrl from '../sample/Nemhauser_et_al_hormones.txt';

class QueryBody extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      value: '',
      error: false
    };

    this.fileInput = React.createRef();
  }

  handleSubmit(e) {
    e.preventDefault();
    this.submit();
  }

  handleChange(e) {
    this.setState({
      value: e.target.value,
      error: false
    });
  }

  handleDrop(e) {
    e.preventDefault();
    let file;

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
      this.handleFile(file);
    } else {
      this.setState({
        value: e.dataTransfer.getData('text/plain'),
        error: false
      });
    }
  }

  handleDragOver(e) {
    e.preventDefault();
  }

  handleDragEnter(e) {
    e.preventDefault();

    e.dataTransfer.dropEffect = "copy";
  }

  handleFileInput(e) {
    if (e.target.files) {
      this.handleFile(e.target.files[0]);
    }
  }

  handleUploadClick(e) {
    this.fileInput.current.click();
  }

  handleFile(file) {
    let reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = (e) => {
      this.setState({
        value: e.target.result,
        error: false
      });
    };
  }

  submit() {
    let {value} = this.state;

    this.props.getSungear(value).then(() => {
      this.props.setQuery(value);
      this.props.history.push('/sungear');
    }).catch(() => {
      this.setState({error: true});
    });
  }

  clear() {
    this.setState({
      value: '',
      error: false
    });
  }

  demoClick(e) {
    e.preventDefault();

    fetch(fileUrl)
      .then((resp) => resp.text())
      .then((text) => {
        this.setState({value: text}, this.submit.bind(this));
      })
      .catch(() => {
        this.setState({error: true});
      });
  }

  render() {
    let {error} = this.state;

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
                     onDragEnter={this.handleDragEnter.bind(this)}
                     onDragOver={this.handleDragOver.bind(this)}
                     onDrop={this.handleDrop.bind(this)}>
                  <div className="input-group-prepend">
                    <button type="button" className="btn btn-outline-secondary"
                            onClick={this.handleUploadClick.bind(this)}>
                      Upload
                    </button>
                  </div>
                  <textarea className={classNames("form-control", error && "is-invalid")} placeholder="Input Lists Here"
                            rows={5}
                            onChange={this.handleChange.bind(this)}
                            value={this.state.value}/>
                  <div className="input-group-append">
                    <button type="button" className="btn btn-outline-danger" onClick={this.clear.bind(this)}>Clear
                    </button>
                    <button className="btn btn-primary">Submit</button>
                  </div>
                </div>
                <small>
                  You can also drag and drop text files.
                </small>
                <small className="form-text text-muted">
                  <a href="#" onClick={this.demoClick.bind(this)}>demo</a>
                </small>
                <small className="form-text text-muted">
                  <a href={fileUrl} download>sample file</a>
                </small>
              </div>
              <input type="file" hidden ref={this.fileInput} onChange={this.handleFileInput.bind(this)}/>
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
