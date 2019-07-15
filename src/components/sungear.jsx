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
import IntersectionIcon from "../images/intersection.svg";
import UnionIcon from "../images/combination.svg";
import {faExpand, faSearchMinus, faSearchPlus} from '@fortawesome/free-solid-svg-icons';

library.add(faSearchPlus, faSearchMinus, faExpand);

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

export class Sungear extends React.Component {
  constructor(props) {
    super(props);

    this.canvas = React.createRef();

    this.state = {
      selectMode: "union"
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
    let {width, height, data, selected, vertexFormatter, strokeColor} = this.props;

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

    let side = Math.min(width, height);
    let polygon, r, polySide;
    let center = [side / 2 + 0.05 * width, side / 2];
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
        let {fillColor} = self.props;
        this.attr("fill", fillColor);

        _.forEach(intersects, (n, i) => {
          if (n[0].indexOf(idx) !== -1) {
            let c = self.circles[i].attr("fill", fillColor);
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
        let {selected} = this.props;
        let toSelect = _(intersects).map((n, i) => {
          if (n[0].indexOf(idx) !== -1) {
            return i;
          }
        }).filter(_.negate(_.isUndefined)).value();

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

    let numThings = _(intersects).map(4).map(_.size).sum();

    for (let [i, n] of intersects.entries()) {
      let c = this.paper.circle(...n[1], n[3]);
      this.circles.push(c);

      c.attr({fill: "#fff", 'fill-opacity': 1});

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
      });

      c.mouseover(function () {
        let {fillColor} = self.props;

        this.attr({fill: fillColor, 'fill-opacity': 1});

        for (let idx of n[0]) {
          self.labels[_.findIndex(vertices, (v) => v[0] === idx)].attr("fill", fillColor);
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

  render() {
    let {className, width, height} = this.props;
    let {selectMode} = this.state;

    return <div style={{width, height, position: 'relative'}}>
      <div ref={this.canvas}
           className={classNames(className)}/>
      <div className="d-flex flex-column" style={{position: 'absolute', top: '10px', left: '0px'}}>
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
  strokeColor: PropTypes.string
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
  constructor(props) {
    super(props);

    this.listOuterRef = React.createRef();

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
    this.setState({
      height: document.documentElement.clientHeight - this.listOuterRef.current.getBoundingClientRect().top
    });
  }

  renderItem({index, style}) {
    return <li className="list-group-item" style={style}>
      {this.props.items[index]}
    </li>;
  }

  render() {
    return <List className={this.props.className}
                 ref={this.props.listRef}
                 outerRef={this.listOuterRef}
                 innerElementType={"ul"}
                 itemSize={50}
                 height={this.state.height}
                 itemCount={this.props.items.length}>
      {this.renderItem.bind(this)}
    </List>;
  }
}

ItemList.propTypes = {
  items: PropTypes.array.isRequired,
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
