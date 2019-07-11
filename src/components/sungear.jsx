/**
 * @author zacharyjuang
 * 2019-07-09
 */
import React from "react";
import Raphael from 'raphael';
import _ from 'lodash';
import PropTypes from 'prop-types';
import {FontAwesomeIcon as Icon} from "@fortawesome/react-fontawesome";
import {connect} from "react-redux";
import classNames from "classnames";
import {getSungear} from "../actions";
import {library} from '@fortawesome/fontawesome-svg-core';
import {
  faSearchPlus,
  faSearchMinus,
  faExpand
} from '@fortawesome/free-solid-svg-icons';

library.add(faSearchPlus, faSearchMinus, faExpand);

function mapStateToProps({query, data}) {
  return {
    query,
    data
  };
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function subtract(p1, p2) {
  return [p2[0] - p1[0], p2[1] - p1[1]];
}

function add(p1, p2) {
  return [p2[0] + p1[0], p2[1] + p1[1]];
}

function scaleVector(v, scale = 1, xoffset = 0, yoffset = 0) {
  return [v[0] * scale + xoffset, v[1] * scale + yoffset];
}

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

export class SungearGraph extends React.Component {
  constructor(props) {
    super(props);

    this.canvas = React.createRef();

    this.circles = [];
    this.labels = [];

    this.mousedown = false;
    this.mousedownStart = 0;

    this.scale = 1;
    this.vX = 0;
    this.vY = 0;

    this.prevX = 0;
    this.prevY = 0;

    this.handleScroll = this.handleScroll.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
  }

  componentDidMount() {
    this.paper = Raphael(this.canvas.current);
    this.canvas.current.addEventListener('wheel', this.handleScroll);
    this.canvas.current.addEventListener('drag', this.handleDrag);
    this.canvas.current.addEventListener('mousedown', (e) => {
      this.prevX = e.x;
      this.prevY = e.y;
      this.mousedown = true;
      this.mousedownStart = e.timeStamp;
    });
    this.canvas.current.addEventListener('mouseup', () => {
      this.mousedown = false;
    });
    this.canvas.current.addEventListener('click', (e) => {
      if (e.timeStamp - this.mousedownStart < 500) {
        this.props.onSelectChange([]);
      }
    });

    this.canvas.current.addEventListener('mousemove', this.handleDrag);
  }

  componentDidUpdate(prevProps) {
    let {width, height, data, selected, vertexFormatter} = this.props;

    if (height !== prevProps.height || width !== prevProps.width) {
      this.paper.setSize(width, height);
    }

    if (!_.isEmpty(data) && width && height &&
      (height !== prevProps.height ||
        width !== prevProps.width ||
        data !== prevProps.data ||
        vertexFormatter !== prevProps.vertexFormatter)) {
      this.draw();
    }

    if (data !== prevProps.data && !_.isEmpty(data)) {
      this.resetView();
    }

    if (selected !== prevProps.selected) {
      for (let [i, c] of this.circles.entries()) {
        if (selected.indexOf(i) !== -1) {
          c.attr("stroke", "#257AFD");
        } else {
          c.attr("stroke", "#000");
        }
      }
    }
  }

  draw() {
    let self = this;
    let {height, width, data, selected, onSelectChange, vertexFormatter} = this.props;

    let side = Math.min(width, height);
    let polygon, r, polySide;
    let center = [side / 2 + 0.05 * width, side / 2]; // @todo: move to center of page
    const applyHeight = _.partial(scaleVector, _, side, 0.05 * width);
    this.circles = [];
    this.labels = [];

    this.paper.clear();

    let vertices = _.map(data.vertices, ([n, coords]) => {
      return [n, applyHeight(coords)];
    });

    let v = _.map(vertices, 1);

    let intersects = _.map(data.intersects, ([v, c, g, s, arrows]) => {
      return [v, applyHeight(c), g, s * side, _.map(arrows, _.unary(applyHeight))];
    });

    if (_.size(v) === 2) {
      r = distance(...v[0], ...v[1]) / 2;
      polygon = this.paper.path(`
        M ${v[0][0]} ${v[0][1]}
        A ${r} ${r} 0 0 1 ${v[1][0]} ${v[1][1]}
        A ${r} ${r} 0 0 1 ${v[0][0]} ${v[0][1]}
      `);
      polySide = r;
    } else {
      let [v0, ...vr] = v;
      polySide = distance(...v0, ...v[1]);
      r = polySide / (2 * Math.tan(Math.PI / v.length));
      polygon = this.paper.path(`M ${v0[0]} ${v0[1]}\n` + _([...vr, v0]).map((vi) => `L ${vi[0]} ${vi[1]}`).join('\n'));
    }

    // draw vertices
    for (let [j, [idx, v]] of vertices.entries()) {
      let cv = subtract(center, v);
      let vlen = distance(...cv, 0, 0);
      let vloc = add(scaleVector(cv, (20 + vlen) / vlen), center);

      let rotation = (360 - (360 / vertices.length) * j) % 360;

      let t = this.paper.text(...vloc, vertexFormatter[idx] || idx.toString());
      let tW = t.getBBox().width;

      this.labels.push(t);

      // keep text as upright as possible
      if (rotation < 270 && rotation > 90) {
        t.rotate(rotation - 180);
      } else {
        t.rotate(rotation);
      }

      if (tW > polySide) {
        // scale if too big
        let s = polySide / tW;
        t.scale(s, s);
      }

      t.mouseover(function () {
        this.attr("fill", "#257AFD");

        _.forEach(intersects, (n, i) => {
          if (n[0].indexOf(idx) !== -1) {
            let c = self.circles[i].attr("fill", "#257AFD");
            c.toFront();
          }
        });
      });

      t.mouseout(function () {
        this.attr("fill", "#000");

        _.forEach(intersects, (n, i) => {
          if (n[0].indexOf(idx) !== -1) {
            self.circles[i].attr("fill", "#fff");
          }
        });
      });

      t.click((e) => {
        e.stopPropagation();
        let toSelect = _(intersects).map((n, i) => {
          if (n[0].indexOf(idx) !== -1) {
            return i;
          }
        }).filter(_.negate(_.isUndefined)).value();

        if (e.metaKey) {
          onSelectChange(_.uniq([...selected, ...toSelect]));
        } else if (e.altKey) {
          onSelectChange(_.difference(selected, toSelect));
        } else {
          onSelectChange(toSelect);
        }
      });
    }

    let numThings = _(intersects).map(4).map(_.size).sum();

    for (let [i, n] of intersects.entries()) {
      let c = this.paper.circle(...n[1], n[3]);
      this.circles.push(c);

      c.attr({fill: "#fff", 'fill-opacity': 1});

      c.click((e) => {
        e.stopPropagation();
        if (e.metaKey) {
          if (selected.indexOf(i) === -1) {
            onSelectChange([...selected, i]);
          } else {
            onSelectChange(selected.filter((s) => s !== i));
          }
        } else {
          onSelectChange([i]);
        }
      });

      c.mouseover(function () {
        this.attr({fill: "#257AFD", 'fill-opacity': 1});

        for (let idx of n[0]) {
          self.labels[_.findIndex(vertices, (v) => v[0] === idx)].attr("fill", "#257AFD");
        }
      });

      c.mouseout(function () {
        c.attr({fill: "#fff", 'fill-opacity': 1});

        for (let idx of n[0]) {
          self.labels[_.findIndex(vertices, (v) => v[0] === idx)].attr("fill", "#000");
        }
      });

      if (numThings < 600) {
        for (let a of n[4]) {
          let p = this.paper.path(`
          M ${n[1][0]} ${n[1][1]}
          L ${a[0]} ${a[1]}
          `);
          p.attr("arrow-end", "classic");
        }
        c.toFront();
      } else {
        let arrows = this.paper.set();

        c.mouseover(() => {
          c.attr('fill-opacity', 1);
          for (let a of n[4]) {
            let p = this.paper.path(`
            M ${n[1][0]} ${n[1][1]}
            L ${a[0]} ${a[1]}
            `);
            p.attr("arrow-end", "classic");

            arrows.push(p);
            c.toFront();
          }
        });

        c.mouseout(() => {
          c.attr('fill-opacity', 0);
          arrows.remove();
          arrows.clear();
        });
      }
    }
  }

  get vW() {
    return this.paper.width * this.scale;
  }

  get vH() {
    return this.paper.height * this.scale;
  }

  handleScroll(e) {
    e.preventDefault();

    let {deltaY} = e;

    if (deltaY > 0) {
      this.zoomOut();
    } else if (deltaY < 0) {
      this.zoomIn();
    }
  }

  handleDrag(e) {
    e.preventDefault();
    if (this.mousedown) {
      this.vX += (this.prevX - e.x) * this.scale;
      this.vY += (this.prevY - e.y) * this.scale;

      this.prevX = e.x;
      this.prevY = e.y;

      this.paper.setViewBox(this.vX, this.vY, this.vW, this.vH);
    }
  }

  resetView() {
    this.scale = 1;
    this.vX = 0;
    this.vY = 0;

    this.paper.setViewBox(0, 0, this.vW, this.vH);
  }

  zoomIn() {
    this.scale *= 0.95;
    this.paper.setViewBox(this.vX, this.vY, this.vW, this.vH);
  }

  zoomOut() {
    this.scale *= 1.05;
    this.paper.setViewBox(this.vX, this.vY, this.vW, this.vH);
  }

  render() {
    let {className, width, height} = this.props;
    return <div style={{width, height, position: 'relative'}}>
      <div ref={this.canvas}
           className={classNames(className)}/>
      <div style={{position: 'absolute', top: '10px', left: '0px'}}>
        <div className="btn-group-vertical">
          <button type="button" className="btn btn-primary btn-sm" onClick={this.resetView.bind(this)}>
            <Icon icon="expand" className="mr-1"/>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={this.zoomIn.bind(this)}>
            <Icon icon="search-plus" className="mr-1"/>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={this.zoomOut.bind(this)}>
            <Icon icon="search-minus" className="mr-1"/>
          </button>
        </div>
      </div>
    </div>;
  }
}

SungearGraph.propTypes = {
  className: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  data: PropTypes.object.isRequired,
  selected: PropTypes.array,
  onSelectChange: PropTypes.func,
  vertexFormatter: PropTypes.object
};

SungearGraph.defaultProps = {
  width: 1280,
  height: 800,
  onSelectChange: _.noop,
  vertexFormatter: {}
};

class SungearBody extends React.Component {
  constructor(props) {
    super(props);

    this.canvas = React.createRef();

    this.state = {
      height: 0,
      width: 0,
      data: {},
      items: [],

      itemsCurr: [],
      itemsPast: [],
      itemsFuture: [],

      selected: []
    };

    this.setSize = _.debounce(this.setSize.bind(this), 100);
  }

  componentDidMount() {
    this.getSungear();

    this.setSize();
    window.addEventListener('resize', this.setSize);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.selected !== prevState.selected) {
      this.setState({
        items: _(this.state.selected).map((s) => this.props.data.intersects[s][2]).flatten().sortBy().value()
      });
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

  render() {
    let {height, width, selected, items} = this.state;
    let {data} = this.props;

    return <div className="container-fluid">
      <div className="row">
        <div ref={this.canvas} className="col-8 w-100">
          <SungearGraph width={width}
                        height={height}
                        data={data}
                        selected={selected}
                        onSelectChange={this.handleSelect.bind(this)}/>
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
              <div>Selections:</div>
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
                <a className="btn btn-primary" href={'data:text/plain,' + _.join(this.state.items, '\n') + '\n'}
                   download="items.txt">Export Items</a>
                <button type="button" className="btn btn-primary" onClick={this.exportSvg.bind(this)}>Export Image
                </button>
              </div>
            </div>
          </div>
          <div className="row m-1">
            <div className="col">
              <p>
                {items.length.toLocaleString()} items
              </p>
              <div className="overflow-auto border rounded" style={{maxHeight: '50vh'}}>
                <ul className="list-group-flush">
                  {_.map(items, (g, i) => <li key={i} className="list-group-item">{g}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
  }
}

SungearBody.propTypes = {
  query: PropTypes.string,
  data: PropTypes.object,
  getSungear: PropTypes.func
};

const Sungear = connect(mapStateToProps, {getSungear})(SungearBody);

export default Sungear;
