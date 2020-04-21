/**
 * @author zacharyjuang
 * 2019-07-09
 */
import React from "react";
import Raphael from 'raphael';
import _ from 'lodash';
import PropTypes from 'prop-types';
import {FontAwesomeIcon as Icon} from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import {FixedSizeList as List} from "react-window";
import {buildSearchRegex} from "../utils";
import {library} from '@fortawesome/fontawesome-svg-core';
import IntersectionIcon from "./icons/intersection_icon";
import UnionIcon from "./icons/union_icon";
import convert from "color-convert";
import {faExpand, faLock, faSearchMinus, faSearchPlus, faSync, faUnlock} from '@fortawesome/free-solid-svg-icons';
import noUiSlider from 'nouislider';
import 'nouislider/distribute/nouislider.css';
import '../styles/styles.css';

library.add(faSearchPlus, faSearchMinus, faExpand, faLock, faUnlock, faSync);

const clampExp = _.flow(_.partial(_.clamp, _, Number.MIN_VALUE, Number.MAX_VALUE), Math.log10, (x) => x * -1);

export function colorGradient(neutral, extreme, cutoff = 0.05) {
  let neutralRGB = convert.hex.rgb(neutral);
  let extremeRGB = convert.hex.rgb(extreme);
  let negLog10Cutoff = clampExp(cutoff);

  return function (curr, min, max) {
    if (curr < negLog10Cutoff) {
      return neutral;
    } else if (min === max) {
      return extreme;
    } else if (min > max) {
      [min, max] = [max, min];
    }
    let scale = (curr - min + 1) / (max - min + 1);
    return '#' + convert.rgb.hex(_(neutralRGB).zip(extremeRGB).map(([nc, ec]) => nc * (1 - scale) + ec * scale).value());
  };
}

const _orangeShader = colorGradient('#fff', '#b40426');
const _blueShader = colorGradient('#fff', '#3b4cc0');

export function getLogMinMax(data, cutoff = 0.05) {
  let res = _(data).flatten().filter(_.isNumber);

  return [clampExp(res.min()), Math.min(clampExp(res.max()), clampExp(cutoff))];
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

class Tooltip extends React.PureComponent {
  render() {
    let {show, x, y} = this.props;
    let style = {
      display: show ? "block" : "none",
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      fontSize: '0.8em'
    };

    return <div style={style} className="border bg-white px-2">
      {this.props.children}
    </div>;
  }
}

Tooltip.propTypes = {
  show: PropTypes.bool.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  children: PropTypes.node
};

function showTooltip() {
  this.updateOptions({tooltips: true});
}

function hideTooltip() {
  this.updateOptions({tooltips: false});
}

class Slider extends React.Component {
  constructor(props) {
    super(props);
    this.containerRef = React.createRef();

    this.sliderOverRef = React.createRef();
    this.sliderUnderRef = React.createRef();

    this.state = {
      lock: false
    };
  }

  componentDidMount() {
    let {maxLogP} = this.props;
    let self = this;

    this.sliderOver = noUiSlider.create(this.sliderOverRef.current, {
      start: [0],
      connect: true,
      range: {
        'min': 0,
        'max': maxLogP
      }
    });

    this.sliderUnder = noUiSlider.create(this.sliderUnderRef.current, {
      start: [0],
      connect: true,
      range: {
        'min': 0,
        'max': maxLogP
      }
    });

    this.sliderOver.on('slide', (values) => {
      if (this.state.lock) {
        this.sliderUnder.set(values);
      }
    });

    this.sliderUnder.on('slide', (values) => {
      if (this.state.lock) {
        this.sliderOver.set(values);
      }
    });

    this.sliderOver.on('update', this.props.onOverChange);
    this.sliderUnder.on('update', this.props.onUnderChange);

    this.sliderOver.on('start', showTooltip);
    this.sliderUnder.on('start', showTooltip);
    this.sliderOver.on('end', hideTooltip);
    this.sliderUnder.on('end', hideTooltip);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.lock !== prevState.lock) {
      if (this.state.lock) {
        this.sliderUnder.set(this.sliderOver.get());
      }
    }
  }

  toggleLock() {
    this.setState({
      lock: !this.state.lock
    });
  }

  refresh() {
    this.sliderOver.set(0);
    this.sliderUnder.set(0);
  }

  render() {
    return <div className="mx-2 d-flex flex-column align-items-center" ref={this.containerRef}>
      <div style={{fontSize: '8px'}}>Overrepresented</div>
      <div className="p-0 mx-2">
        <div ref={this.sliderOverRef} className="slider slider-over"/>
        <div ref={this.sliderUnderRef} className="slider slider-under"/>
      </div>
      <div style={{fontSize: '8px'}}>Underrepresented</div>
      <div>
        <span onClick={this.toggleLock.bind(this)} className="mx-1">
          {this.state.lock ? <Icon icon="lock"/> : <Icon icon="unlock"/>}
        </span>
        <span onClick={this.refresh.bind(this)} className="mx-1"><Icon icon="sync"/></span>
      </div>
    </div>;
  }
}

Slider.propTypes = {
  onOverChange: PropTypes.func,
  onUnderChange: PropTypes.func,
  maxLogP: PropTypes.number
};

export class Sungear extends React.Component {
  constructor(props) {
    super(props);

    this.canvas = React.createRef();

    this.state = {
      selectMode: "union",

      toolTipX: 0,
      toolTipY: 0,
      toolTipShow: false,
      toolTipContent: null,

      maxLogP: 0,

      cutoffOverP: 0,
      cutoffUnderP: 0
    };

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

    this.onOverChange = _.throttle(this.onOverChange.bind(this), 100);
    this.onUnderChange = _.throttle(this.onUnderChange.bind(this), 100);
  }

  componentDidMount() {
    this.paper = Raphael(this.canvas.current);
    // throttle setViewBox to fix performance when dragging and zooming
    this.paper.setViewBox = _.throttle(this.paper.setViewBox.bind(this.paper), 100);

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

  componentDidUpdate(prevProps, prevState) {
    let {width, height, data, selected, vertexFormatter, strokeColor} = this.props;

    if (height !== prevProps.height || width !== prevProps.width) {
      this.paper.setSize(width, height);
    }

    if (!_.isEmpty(data) && width && height &&
      (height !== prevProps.height ||
        width !== prevProps.width ||
        data !== prevProps.data ||
        vertexFormatter !== prevProps.vertexFormatter ||
        (this.state.cutoffOverP !== prevState.cutoffOverP || this.state.cutoffUnderP !== prevState.cutoffUnderP))) {
      this.draw();
    }

    if (data !== prevProps.data && !_.isEmpty(data)) {
      this.resetView();
    }

    if (selected !== prevProps.selected) {
      for (let [i, c] of this.circles.entries()) {
        if (!c) {
          continue;
        }

        if (selected.indexOf(i) !== -1) {
          c.attr("stroke", strokeColor);
        } else {
          c.attr("stroke", "#000");
        }
      }
    }

    if (strokeColor !== prevProps.strokeColor && selected === prevProps.selected) {
      for (let i of selected) {
        this.circles[i].attr("stroke", strokeColor);
      }
    }
  }

  draw() {
    let self = this;
    let {height, width, data, onSelectChange, vertexFormatter} = this.props;
    let {cutoffOverP, cutoffUnderP} = this.state;

    let side = Math.min(width, height);
    let polygon, r, polySide;
    let center = [side / 2, side / 2];
    const applyHeight = _.partial(scaleVector, _, side);
    this.circles = [];
    this.labels = [];

    this.paper.clear();

    let vertices = _.map(data.vertices, ([n, coords]) => {
      return [n, applyHeight(coords)];
    });

    let v = _.map(vertices, 1);

    let intersects = _.map(data.intersects, ([v, c, g, p, s, arrows]) => {
      return [v, applyHeight(c), g, p, s * side, _.map(arrows, _.unary(applyHeight))];
    });

    let pVals = _(intersects).map(3).map('adj_p').map(clampExp).value();
    let minLogP = _.min(pVals);
    let maxLogP = _.max(pVals);

    this.setState({
      maxLogP
    });

    let orangeShader = _.unary(_.partial(_orangeShader, _, minLogP, maxLogP));
    let blueShader = _.unary(_.partial(_blueShader, _, minLogP, maxLogP));
    let colorShadeShow = _(intersects).zip(pVals).map(([n, p]) => {
      if (n[3]['expected'] < n[2].length) {
        return [orangeShader(p), p >= cutoffOverP];
      }
      return [blueShader(p), p >= cutoffUnderP];
    }).value();

    let [colorShades, show] = _.zip(...colorShadeShow);

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
        let {fillColor} = self.props;
        this.attr("fill", fillColor);

        _.forEach(intersects, (n, i) => {
          if (_.findIndex(n[0], (j) => _.isEqual(j, idx)) !== -1) {
            let c = self.circles[i];
            if (c) {
              c.attr("fill", fillColor);
              c.toFront();
            }
          }
        });
      });

      t.mouseout(function () {
        this.attr("fill", "#000");

        _.forEach(intersects, (n, i) => {
          if (_.findIndex(n[0], (j) => _.isEqual(j, idx)) !== -1) {
            let c = self.circles[i];
            if (c) {
              c.attr("fill", colorShades[i]);
            }
          }
        });
      });

      t.click((e) => {
        e.stopPropagation();
        let {selected} = this.props;
        let toSelect = _(intersects)
          .map((n, i) => {
            if (_.findIndex(n[0], (j) => _.isEqual(j, idx)) !== -1) {
              return i;
            }
          })
          .zip(show)
          .map(([i, s]) => s ? i : undefined)
          .filter(_.negate(_.isUndefined)).value();

        if (e.metaKey || e.shiftKey || e.ctrlKey) {
          let {selectMode} = this.state;
          if (selectMode === "union" || !selected.length) {
            onSelectChange(_.uniq([...selected, ...toSelect]));
          } else {
            // selectMode === "intersection"
            onSelectChange(_.uniq(_.intersection(selected, toSelect)));
          }
        } else if (e.altKey) {
          onSelectChange(_.difference(selected, toSelect));
        } else {
          onSelectChange(toSelect);
        }
      });
    }

    let numThings = _(intersects).map(5).map(_.size).sum();

    // draw nodes
    for (let [i, n] of intersects.entries()) {
      if (!show[i]) {
        this.circles.push(undefined);
        continue;
      }

      let c = this.paper.circle(...n[1], n[4]);
      let color = colorShades[i];
      this.circles.push(c);

      c.attr("fill", color);

      c.click((e) => {
        e.stopPropagation();
        let {selected} = this.props;

        if (e.metaKey || e.shiftKey || e.ctrlKey) {
          if (selected.indexOf(i) === -1) {
            onSelectChange([...selected, i]);
          } else {
            onSelectChange(selected.filter((s) => s !== i));
          }
        } else {
          onSelectChange([i]);
        }

        if (_.isFunction(self.props.onNodeClick)) {
          self.props.onNodeClick(n);
        }
      });

      c.mouseover(function () {
        let {fillColor} = self.props;
        self.setState({
          toolTipShow: true,
          toolTipContent: <div>
            <p className="mb-0">p-value: {n[3]['p_value'].toExponential(3)}</p>
            <p className="mb-0">adjusted p-value: {n[3]['adj_p'].toExponential(3)}</p>
            <p className="mb-0">size: {n[2].length}</p>
            <p className="mb-0">expected: {n[3]['expected'].toFixed(3)}</p>
          </div>
        });

        this.attr("fill", fillColor);

        for (let idx of n[0]) {
          self.labels[_.findIndex(vertices, (v) => _.isEqual(v[0], idx))].attr("fill", fillColor);
        }
      });

      c.mouseout(function () {
        this.attr("fill", color);
        self.setState({
          toolTipShow: false
        });

        for (let idx of n[0]) {
          self.labels[_.findIndex(vertices, (v) => _.isEqual(v[0], idx))].attr("fill", "#000");
        }
      });

      if (numThings < 600) {
        for (let a of n[5]) {
          let p = this.paper.path(`
          M ${n[1][0]} ${n[1][1]}
          L ${a[0]} ${a[1]}
          `);
          p.attr("arrow-end", "classic");
        }
        c.toFront();
      } else {
        let arrows = this.paper.set();

        c.mouseover(function () {
          for (let a of n[5]) {
            let p = self.paper.path(`
            M ${n[1][0]} ${n[1][1]}
            L ${a[0]} ${a[1]}
            `);
            p.attr("arrow-end", "classic");

            arrows.push(p);
            this.toFront();
          }
        });

        c.mouseout(function () {
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
    let {x, y} = e;

    if (this.mousedown) {
      this.vX += (this.prevX - x) * this.scale;
      this.vY += (this.prevY - y) * this.scale;

      this.prevX = x;
      this.prevY = y;

      this.paper.setViewBox(this.vX, this.vY, this.vW, this.vH);
    } else {
      this.setState({
        toolTipX: x + 10,
        toolTipY: y + 10
      });
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
    this.scale = Math.max(this.scale, 0.1);
    this.paper.setViewBox(this.vX, this.vY, this.vW, this.vH);
  }

  zoomOut() {
    this.scale *= 1.05;
    this.scale = Math.min(this.scale, 10);
    this.paper.setViewBox(this.vX, this.vY, this.vW, this.vH);
  }

  setSelectMode(selectMode) {
    this.setState({
      selectMode
    });
  }

  onOverChange(values, handle) {
    this.setState({
      cutoffOverP: parseFloat(values[handle])
    });
  }

  onUnderChange(values, handle) {
    this.setState({
      cutoffUnderP: parseFloat(values[handle])
    });
  }

  render() {
    let {className, width, height} = this.props;
    let {selectMode, toolTipX, toolTipY, toolTipShow, toolTipContent, maxLogP} = this.state;

    return <div style={{width, height, position: 'relative'}}>
      <div ref={this.canvas}
           className={className}/>
      <div className="d-flex flex-column" style={{position: 'absolute', top: '10px', left: '10px'}}>
        <div className="btn-group-vertical mb-2">
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

        <div className="btn-group-vertical">
          <button type="button"
                  className={classNames("btn btn-primary py-0 px-1", selectMode === "union" && "active")}
                  onClick={this.setSelectMode.bind(this, "union")}
                  title="union">
            <UnionIcon width="32" height="32" viewBox="0 93 455 270" style={{fill: "#ffffff"}}/>
          </button>
          <button type="button"
                  className={classNames("btn btn-primary py-0 px-1", selectMode === "intersection" && "active")}
                  onClick={this.setSelectMode.bind(this, "intersection")}
                  title="intersection">
            <IntersectionIcon width="32" height="32" viewBox="0 93 455 270" style={{fill: "#ffffff"}}/>
          </button>
        </div>
      </div>
      <Tooltip x={toolTipX} y={toolTipY} show={toolTipShow}>
        {toolTipContent}
      </Tooltip>

      <div style={{position: 'absolute', right: '10px', bottom: '10px', background: 'rgba(255, 255, 255, 0.7)'}}
           className="d-flex align-items-center border rounded px-2 py-0">
        <div className="mr-1">-Log10 p-value</div>
        <div>≤{-Math.log10(0.05).toFixed(2)}</div>
        {maxLogP ?
          <Slider onOverChange={this.onOverChange}
                  onUnderChange={this.onUnderChange}
                  maxLogP={maxLogP}/> :
          null}
        <div>{maxLogP.toFixed(2)}</div>
      </div>
    </div>;
  }
}

Sungear.propTypes = {
  className: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  data: PropTypes.object.isRequired,
  selected: PropTypes.array,
  onSelectChange: PropTypes.func,
  vertexFormatter: PropTypes.object,
  fillColor: PropTypes.string,
  strokeColor: PropTypes.string,
  onNodeClick: PropTypes.func
};

Sungear.defaultProps = {
  width: 1280,
  height: 800,
  onSelectChange: _.noop,
  vertexFormatter: {},
  fillColor: "#257AFD",
  strokeColor: "#257AFD"
};

export class ItemList extends React.PureComponent {
  renderItem({index, style}) {
    return <li className="list-group-item" style={style}>
      {this.props.items[index]}
    </li>;
  }

  render() {
    return <List className={this.props.className}
                 ref={this.props.listRef}
                 innerElementType={"ul"}
                 itemSize={50}
                 height={this.props.height}
                 itemCount={this.props.items.length}>
      {this.renderItem.bind(this)}
    </List>;
  }
}

ItemList.propTypes = {
  items: PropTypes.array.isRequired,
  height: PropTypes.number.isRequired,
  listRef: PropTypes.object,
  className: PropTypes.string
};

export class Search extends React.Component {
  constructor(props) {
    super(props);

    this.searchIntersects = _.debounce(this.searchIntersects.bind(this), 150);
  }

  componentDidUpdate(prevProps) {
    let {value} = this.props;

    if (value !== prevProps.value) {
      this.searchIntersects(value);
    }
  }

  searchIntersects(value) {
    let {onSelectChange, data} = this.props;

    if (value) {
      let searchRegex = buildSearchRegex(value);

      onSelectChange(_(data.intersects)
        .map((n, i) => {
          if (_.findIndex(n[2], (s) => searchRegex.test(s)) !== -1) {
            return i;
          }
        })
        .filter(_.negate(_.isUndefined))
        .value());
    } else {
      onSelectChange([]);
    }

  }

  render() {
    return <input type="search"
                  className="form-control"
                  placeholder="Search"
                  value={this.props.value}
                  onChange={this.props.onChange}/>;
  }
}

Search.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  selected: PropTypes.array,
  onSelectChange: PropTypes.func,
  data: PropTypes.object
};

export class VertexCount extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      nodeByCount: []
    };
  }

  componentDidMount() {
    this.prepCounts();
  }

  componentDidUpdate(prevProps) {
    let {data} = this.props;
    if (data !== prevProps.data) {
      this.prepCounts();
    }
  }

  prepCounts() {
    let {data} = this.props;
    this.setState({
      nodeByCount: _(_.reduce(data.intersects,
        (acc, val, i) => {
          let vertexNum = val[0].length;

          if (vertexNum in acc) {
            acc[vertexNum].push(i);
          } else {
            acc[vertexNum] = [i];
          }

          return acc;
        },
        {}))
        .toPairs()
        .map(([i, nodes]) => {
          return [parseInt(i), nodes.length, _(nodes).map((j) => data.intersects[j][2].length).sum(), nodes];
        })
        .orderBy([0], ['asc'])
        .value()
    });
  }

  onRowSelect(row, e) {
    let {onSelectChange, selected} = this.props;
    let isSelected = !_.difference(row[3], selected).length;
    if (e.metaKey || e.shiftKey || e.ctrlKey) {
      if (isSelected) {
        onSelectChange(_.difference(selected, row[3]));
      } else {
        onSelectChange(_.uniq(selected.concat(row[3])));
      }
    } else {
      if (isSelected && !_.difference(selected, row[3]).length) {
        onSelectChange([]);
      } else {
        onSelectChange(row[3]);
      }
    }
  }

  render() {
    let {selected} = this.props;
    let {nodeByCount} = this.state;

    return <div style={{maxHeight: '300px', overflow: 'scroll'}}>
      <table className="table table-bordered table-hover">
        <thead>
        <tr>
          <th>No. Vertices</th>
          <th>No. Vessels</th>
          <th>No. Items</th>
        </tr>
        </thead>
        <tbody>
        {_.map(nodeByCount, (row, i) => {
          return <tr key={i}
                     className={classNames(!_.difference(row[3], selected).length && 'table-primary')}
                     onClick={this.onRowSelect.bind(this, row)}>
            <td>{row[0]}</td>
            <td>{row[1]}</td>
            <td>{row[2]}</td>
          </tr>;
        })}
        </tbody>
      </table>
    </div>;
  }
}

VertexCount.propTypes = {
  data: PropTypes.object,
  selected: PropTypes.arrayOf(PropTypes.number),
  onSelectChange: PropTypes.func
};
