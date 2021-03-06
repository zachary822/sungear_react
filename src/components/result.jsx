/**
 * @author zacharyjuang
 * 2019-07-12
 */
import React from "react";
import _ from "lodash";
import {FontAwesomeIcon as Icon} from "@fortawesome/react-fontawesome";
import PropTypes from "prop-types";
import {connect} from "react-redux";
import {getSungear} from "../actions";
import {ItemList as ItemListBody, Search, Sungear, VertexCount} from "./sungear";
import {buildSearchRegex} from "../utils";
import {library} from '@fortawesome/fontawesome-svg-core';
import {
  faArrowCircleLeft,
  faArrowCircleRight,
  faFileAlt,
  faFilter,
  faImage,
  faObjectGroup,
  faSync
} from '@fortawesome/free-solid-svg-icons';

library.add(faObjectGroup, faFilter, faSync, faArrowCircleLeft, faArrowCircleRight, faImage, faFileAlt);

function mapStateToProps({query, data}) {
  return {
    query,
    data
  };
}

function resizeListWrapper(Tag) {
  class Wrapper extends React.Component {
    constructor(props) {
      super(props);

      this.itemRef = React.createRef();

      this.state = {
        height: 0
      };

      this.setSize = _.throttle(this.setSize.bind(this), 100);
    }

    componentDidMount() {
      this.setSize();
      window.addEventListener('resize', this.setSize);
    }

    componentWillUnmount() {
      window.removeEventListener('resize', this.setSize);
    }

    setSize() {
      let {clientHeight} = document.documentElement;

      this.setState({
        height: Math.min(
          Math.max(clientHeight - this.itemRef.current.getBoundingClientRect().top, 200),
          clientHeight / 2)
      });
    }

    render() {
      let {className, innerClassName, ...props} = this.props;
      return <div ref={this.itemRef} className={className}>
        <Tag height={this.state.height} className={innerClassName} {...props}/>
      </div>;
    }
  }

  return Wrapper;
}

const ItemList = resizeListWrapper(ItemListBody);

function saveSvg(svgEl, name) {
  svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  let svgData = svgEl.outerHTML;
  let preface = '<?xml version="1.0" standalone="no"?>\r\n';
  let svgBlob = new Blob([preface, svgData], {type: "image/svg+xml;charset=utf-8"});
  let svgUrl = URL.createObjectURL(svgBlob);
  let downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = name;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

class ResultBody extends React.Component {
  constructor(props) {
    super(props);

    this.canvas = React.createRef();
    this.listRef = React.createRef();

    this.state = {
      height: 0,
      width: 0,
      data: {},
      items: [],

      itemsCurr: [],
      itemsPast: [],
      itemsFuture: [],

      selected: [],

      searchTerm: '',

      selectColor: "#257AFD",

      alwaysShowArrows: false,
      showNodeSize: false
    };

    this.setSize = _.throttle(this.setSize.bind(this), 100);
  }

  componentDidMount() {
    this.setSize();
    window.addEventListener('resize', this.setSize);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.selected !== prevState.selected) {
      let items = _(this.state.selected).map((s) => this.props.data.intersects[s][2]).flatten().sortBy().value();
      this.setState(
        {items},
        () => {
          let {searchTerm} = this.state;
          if (searchTerm) {
            let searchRegex = buildSearchRegex(searchTerm);
            let scrollIndex = _.findIndex(items, (g) => searchRegex.test(g));

            if (scrollIndex !== -1) {
              this.listRef.current.scrollToItem(scrollIndex, "start");
            }
          }
        }
      );
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.setSize);
  }

  setSize() {
    let {width, top} = this.canvas.current.getBoundingClientRect();

    this.setState({
      height: document.documentElement.clientHeight - top,
      width
    });
  }

  handleSelect(selected) {
    this.setState({
      selected
    });
  }

  handleSelectColor(e) {
    this.setState({
      selectColor: e.target.value
    });
  }

  getSungear(filterList) {
    let {query} = this.props;
    return this.props.getSungear(query, filterList).then(() => {
      this.setState({selected: []});
    });
  }

  narrowClick(e) {
    e.preventDefault();
    if (this.state.items.length) {
      let {items} = this.state;
      this.getSungear(items).then(() => {
        this.setState((state) => {
          return {
            itemsPast: [...state.itemsPast, state.itemsCurr],
            itemsCurr: items,
            itemsFuture: []
          };
        });
      });
    }
  }

  prevClick(e) {
    e.preventDefault();
    let {itemsPast} = this.state;
    let prevs = itemsPast.slice(0, itemsPast.length - 1);
    let curr = itemsPast[itemsPast.length - 1];

    this.getSungear(curr).then(() => {
      this.setState((state) => {
        return {
          itemsCurr: curr,
          itemsPast: prevs,
          itemsFuture: [state.itemsCurr, ...state.itemsFuture]
        };
      });
    });
  }

  nextClick(e) {
    e.preventDefault();
    let {itemsFuture} = this.state;
    let [curr, ...futures] = itemsFuture;

    this.getSungear(curr).then(() => {
      this.setState((state) => {
        return {
          itemsCurr: curr,
          itemsPast: [...state.itemsPast, state.itemsCurr],
          itemsFuture: futures
        };
      });
    });
  }

  resetClick() {
    this.getSungear().then(() => {
      this.setState({
        itemsCurr: [],
        itemsPast: [],
        itemsFuture: []
      });
    });
  }

  inverseSelection() {
    let {selected} = this.state;
    let {data: {intersects}} = this.props;

    this.setState({
      selected: _.difference(_.range(_.size(intersects)), selected)
    });
  }

  exportSvg() {
    try {
      saveSvg(this.canvas.current.getElementsByTagName('svg')[0], 'sungear.svg');
    } catch (e) {
      //ignore errors
    }

  }

  handleSearch(e) {
    this.setState({
      searchTerm: e.target.value
    });
  }

  showArrows(e) {
    this.setState({alwaysShowArrows: e.target.checked});
  }

  showNodeSize(e) {
    this.setState({showNodeSize: e.target.checked});
  }

  render() {
    let {height, width, selected, items, searchTerm, selectColor, alwaysShowArrows, showNodeSize} = this.state;
    let {data} = this.props;

    return <div className="container-fluid">
      <div className="row">
        <div ref={this.canvas} className="col-8 w-100 p-0">
          <Sungear width={width}
                   height={height}
                   data={data}
                   selected={selected}
                   onSelectChange={this.handleSelect.bind(this)}
                   strokeColor={selectColor}
                   fillColor={selectColor}
                   alwaysShowArrows={alwaysShowArrows}
                   showNodeSize={showNodeSize}/>
        </div>
        <div className="col-4">
          <div className="row m-1">
            <div className="col">
              <div className="btn-group mr-1">
                <button type="button" className="btn btn-primary" onClick={this.narrowClick.bind(this)}>
                  <Icon icon="filter" className="mr-1"/>Narrow
                </button>
                <button type="button" className="btn btn-primary" onClick={this.inverseSelection.bind(this)}>
                  <Icon icon="object-group" className="mr-1"/>Inverse
                </button>
                <button type="button" className="btn btn-primary"
                        onClick={this.resetClick.bind(this)}>
                  <Icon icon="sync" className="mr-1"/>Reset
                </button>
              </div>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <div className="d-inline mr-2">Views:</div>
              <div className="btn-group">
                <button type="button" className="btn btn-primary"
                        disabled={!this.state.itemsPast.length}
                        onClick={this.prevClick.bind(this)}>
                  <Icon icon="arrow-circle-left" className="mr-1"/>Previous
                </button>
                <button type="button" className="btn btn-primary"
                        disabled={!this.state.itemsFuture.length}
                        onClick={this.nextClick.bind(this)}>
                  Next<Icon icon="arrow-circle-right" className="ml-1"/>
                </button>
              </div>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <div className="btn-group">
                <a className="btn btn-primary"
                   href={'data:text/plain,' + _.join(this.state.items, '\n') + '\n'}
                   download="items.txt">
                  <Icon icon="file-alt" className="mr-1"/>Export Items
                </a>
                <button type="button" className="btn btn-primary" onClick={this.exportSvg.bind(this)}>
                  <Icon icon="image" className="mr-1"/>Export Image
                </button>
              </div>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <div className="form-inline">
                <input type="checkbox" id="showarrows" className="form-control"
                       checked={alwaysShowArrows}
                       onChange={this.showArrows.bind(this)}/>
                <label htmlFor="showarrows" className="ml-1">Always Show Node Arrows</label>
              </div>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <div className="form-inline">
                <input type="checkbox" id="showsize" className="form-control"
                       checked={showNodeSize}
                       onChange={this.showNodeSize.bind(this)}/>
                <label htmlFor="showsize" className="ml-1">Show Node Size</label>
              </div>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <div className="form-inline">
                <label className="mr-2" htmlFor="color">Selection Color:</label>
                <input type="color"
                       id="color"
                       className="form-control"
                       style={{minWidth: '50px'}}
                       value={selectColor}
                       onChange={this.handleSelectColor.bind(this)}/>
              </div>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <h6>Info:</h6>
              <p className="text-secondary m-0">Ctrl + Left Click to select multiple nodes.</p>
              <p className="text-secondary m-0">
                Multiple selection on list names (vertices) adds all nodes of the list to the selection.
                New nodes will be added as a <span className="font-weight-bold">Union</span> or <span
                className="font-weight-bold">Intersection </span>
                based on the selection mode selected on the left.
              </p>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <Search value={searchTerm}
                      onChange={this.handleSearch.bind(this)}
                      data={data}
                      selected={selected}
                      onSelectChange={this.handleSelect.bind(this)}/>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <VertexCount data={data} selected={selected} onSelectChange={this.handleSelect.bind(this)}/>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <p>
                {items.length.toLocaleString()} items selected
              </p>
              <ItemList className="list-group" items={items} listRef={this.listRef}/>
            </div>
          </div>
        </div>
      </div>
    </div>;
  }
}

ResultBody.propTypes = {
  query: PropTypes.string,
  data: PropTypes.object,
  getSungear: PropTypes.func
};

const Result = connect(mapStateToProps, {getSungear})(ResultBody);

export default Result;
