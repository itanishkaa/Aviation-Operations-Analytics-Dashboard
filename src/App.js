import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, TrendingUp, Clock, AlertCircle, Download, Calendar, Filter } from 'lucide-react';
import * as d3 from 'd3';

const generateSampleData = () => {
  const carriers = ['AA', 'DL', 'UA', 'WN', 'B6', 'NK', 'F9', 'AS'];
  const airports = ['ATL', 'DFW', 'DEN', 'ORD', 'LAX', 'CLT', 'MCO', 'LAS', 'PHX', 'MIA'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const flights = [];
  
  for (let i = 0; i < 1000; i++) {
    const carrier = carriers[Math.floor(Math.random() * carriers.length)];
    const origin = airports[Math.floor(Math.random() * airports.length)];
    let destination = airports[Math.floor(Math.random() * airports.length)];
    while (destination === origin) {
      destination = airports[Math.floor(Math.random() * airports.length)];
    }
    
    const month = Math.floor(Math.random() * 12);
    const carrierDelay = Math.max(0, Math.random() * 60 - 20);
    const weatherDelay = Math.max(0, Math.random() * 40 - 25);
    const nasDelay = Math.max(0, Math.random() * 30 - 15);
    const totalDelay = carrierDelay + weatherDelay + nasDelay;
    
    flights.push({
      id: i + 1,
      carrier,
      origin,
      destination,
      month: months[month],
      monthNum: month,
      carrierDelay: Math.round(carrierDelay),
      weatherDelay: Math.round(weatherDelay),
      nasDelay: Math.round(nasDelay),
      totalDelay: Math.round(totalDelay),
      cancelled: Math.random() < 0.05,
      distance: Math.floor(Math.random() * 2500 + 300)
    });
  }
  
  return flights;
};

const AviationDashboard = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedCarriers, setSelectedCarriers] = useState([]);
  const [selectedAirports, setSelectedAirports] = useState([]);
  const [dateRange, setDateRange] = useState({ start: 0, end: 11 });
  const [activeTab, setActiveTab] = useState('overview');
  
  const delayHeatmapRef = useRef(null);
  const carrierChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const routeScatterRef = useRef(null);

  useEffect(() => {
    const sampleData = generateSampleData();
    setData(sampleData);
    setFilteredData(sampleData);
  }, []);

  useEffect(() => {
    let filtered = data.filter(flight => {
      const carrierMatch = selectedCarriers.length === 0 || selectedCarriers.includes(flight.carrier);
      const airportMatch = selectedAirports.length === 0 || 
                          selectedAirports.includes(flight.origin) || 
                          selectedAirports.includes(flight.destination);
      const dateMatch = flight.monthNum >= dateRange.start && flight.monthNum <= dateRange.end;
      return carrierMatch && airportMatch && dateMatch;
    });
    setFilteredData(filtered);
  }, [data, selectedCarriers, selectedAirports, dateRange]);

  useEffect(() => {
    if (filteredData.length > 0 && activeTab === 'overview') {
      drawDelayHeatmap();
      drawTrendChart();
    } else if (filteredData.length > 0 && activeTab === 'carriers') {
      drawCarrierChart();
    } else if (filteredData.length > 0 && activeTab === 'routes') {
      drawRouteScatter();
    }
  }, [filteredData, activeTab]);

  const calculateKPIs = () => {
    if (filteredData.length === 0) return { ontimeRate: 0, avgDelay: 0, cancellationRate: 0, totalFlights: 0 };
    
    const ontime = filteredData.filter(f => f.totalDelay < 15).length;
    const cancelled = filteredData.filter(f => f.cancelled).length;
    const totalDelay = filteredData.reduce((sum, f) => sum + f.totalDelay, 0);
    
    return {
      ontimeRate: ((ontime / filteredData.length) * 100).toFixed(1),
      avgDelay: (totalDelay / filteredData.length).toFixed(1),
      cancellationRate: ((cancelled / filteredData.length) * 100).toFixed(1),
      totalFlights: filteredData.length
    };
  };

  const drawDelayHeatmap = () => {
    const svg = d3.select(delayHeatmapRef.current);
    svg.selectAll('*').remove();
    
    const width = 600;
    const height = 250;
    const margin = { top: 20, right: 80, bottom: 60, left: 80 };
    
    const carriers = [...new Set(filteredData.map(d => d.carrier))].sort();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const heatmapData = carriers.flatMap(carrier => 
      months.map(month => {
        const flights = filteredData.filter(f => f.carrier === carrier && f.month === month);
        const avgDelay = flights.length > 0 
          ? flights.reduce((sum, f) => sum + f.totalDelay, 0) / flights.length 
          : 0;
        return { carrier, month, avgDelay, count: flights.length };
      })
    );
    
    const xScale = d3.scaleBand()
      .domain(months)
      .range([margin.left, width - margin.right])
      .padding(0.05);
    
    const yScale = d3.scaleBand()
      .domain(carriers)
      .range([margin.top, height - margin.bottom])
      .padding(0.05);
    
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([60, 0]);
    
    const g = svg.append('g');
    
    g.selectAll('rect')
      .data(heatmapData)
      .join('rect')
      .attr('x', d => xScale(d.month))
      .attr('y', d => yScale(d.carrier))
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => d.count > 0 ? colorScale(d.avgDelay) : '#f0f0f0')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .append('title')
      .text(d => `${d.carrier} - ${d.month}\nAvg Delay: ${d.avgDelay.toFixed(1)} min\nFlights: ${d.count}`);
    
    g.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', '11px');
    
    g.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '11px');
    
    g.append('text')
      .attr('x', width / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .text('Average Delay by Carrier & Month (minutes)');
  };

  const drawCarrierChart = () => {
    const svg = d3.select(carrierChartRef.current);
    svg.selectAll('*').remove();
    
    const width = 700;
    const height = 400;
    const margin = { top: 40, right: 150, bottom: 60, left: 60 };
    
    const carrierStats = d3.rollup(
      filteredData,
      v => ({
        avgDelay: d3.mean(v, d => d.totalDelay),
        carrierDelay: d3.mean(v, d => d.carrierDelay),
        weatherDelay: d3.mean(v, d => d.weatherDelay),
        nasDelay: d3.mean(v, d => d.nasDelay),
        count: v.length
      }),
      d => d.carrier
    );
    
    const chartData = Array.from(carrierStats, ([carrier, stats]) => ({ carrier, ...stats }))
      .sort((a, b) => b.avgDelay - a.avgDelay);
    
    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.carrier))
      .range([margin.left, width - margin.right])
      .padding(0.3);
    
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.avgDelay) * 1.1])
      .range([height - margin.bottom, margin.top]);
    
    const colorScale = d3.scaleOrdinal()
      .domain(['carrierDelay', 'weatherDelay', 'nasDelay'])
      .range(['#ef4444', '#f59e0b', '#3b82f6']);
    
    const g = svg.append('g');
    
    const stack = d3.stack()
      .keys(['carrierDelay', 'weatherDelay', 'nasDelay'])
      .value((d, key) => d[key] || 0);
    
    const series = stack(chartData);
    
    g.selectAll('g.layer')
      .data(series)
      .join('g')
      .attr('class', 'layer')
      .attr('fill', d => colorScale(d.key))
      .selectAll('rect')
      .data(d => d)
      .join('rect')
      .attr('x', d => xScale(d.data.carrier))
      .attr('y', d => yScale(d[1]))
      .attr('height', d => yScale(d[0]) - yScale(d[1]))
      .attr('width', xScale.bandwidth())
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .append('title')
      .text(d => `${d.data.carrier}\nTotal: ${d.data.avgDelay.toFixed(1)} min\nFlights: ${d.data.count}`);
    
    g.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', '12px')
      .style('font-weight', '600');
    
    g.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '11px');
    
    g.append('text')
      .attr('x', margin.left - 45)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90,${margin.left - 45},${height / 2})`)
      .style('font-size', '12px')
      .text('Average Delay (minutes)');
    
    g.append('text')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', '600')
      .text('Carrier Performance: Delay Breakdown');
    
    const legend = g.append('g')
      .attr('transform', `translate(${width - margin.right + 20}, ${margin.top})`);
    
    const legendItems = [
      { key: 'carrierDelay', label: 'Carrier' },
      { key: 'weatherDelay', label: 'Weather' },
      { key: 'nasDelay', label: 'NAS/Airport' }
    ];
    
    legendItems.forEach((item, i) => {
      legend.append('rect')
        .attr('x', 0)
        .attr('y', i * 25)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', colorScale(item.key));
      
      legend.append('text')
        .attr('x', 20)
        .attr('y', i * 25 + 12)
        .style('font-size', '12px')
        .text(item.label);
    });
  };

  const drawTrendChart = () => {
    const svg = d3.select(trendChartRef.current);
    svg.selectAll('*').remove();
    
    const width = 600;
    const height = 250;
    const margin = { top: 30, right: 30, bottom: 60, left: 60 };
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const monthlyData = months.map((month, idx) => {
      const flights = filteredData.filter(f => f.month === month);
      const avgDelay = flights.length > 0 
        ? flights.reduce((sum, f) => sum + f.totalDelay, 0) / flights.length 
        : 0;
      return { month, monthIdx: idx, avgDelay, count: flights.length };
    });
    
    const xScale = d3.scaleLinear()
      .domain([0, 11])
      .range([margin.left, width - margin.right]);
    
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(monthlyData, d => d.avgDelay) * 1.2])
      .range([height - margin.bottom, margin.top]);
    
    const line = d3.line()
      .x(d => xScale(d.monthIdx))
      .y(d => yScale(d.avgDelay))
      .curve(d3.curveMonotoneX);
    
    const g = svg.append('g');
    
    g.append('path')
      .datum(monthlyData)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 3)
      .attr('d', line);
    
    g.selectAll('circle')
      .data(monthlyData)
      .join('circle')
      .attr('cx', d => xScale(d.monthIdx))
      .attr('cy', d => yScale(d.avgDelay))
      .attr('r', 5)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .append('title')
      .text(d => `${d.month}\nAvg Delay: ${d.avgDelay.toFixed(1)} min\nFlights: ${d.count}`);
    
    g.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale)
        .tickValues(d3.range(12))
        .tickFormat(i => months[i]))
      .selectAll('text')
      .style('font-size', '10px')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');
    
    g.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '11px');
    
    g.append('text')
      .attr('x', margin.left - 45)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90,${margin.left - 45},${height / 2})`)
      .style('font-size', '12px')
      .text('Average Delay (minutes)');
    
    g.append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .text('Seasonal Delay Trends');
  };

  const drawRouteScatter = () => {
    const svg = d3.select(routeScatterRef.current);
    svg.selectAll('*').remove();
    
    const width = 700;
    const height = 400;
    const margin = { top: 40, right: 30, bottom: 60, left: 60 };
    
    const routeStats = d3.rollup(
      filteredData,
      v => ({
        avgDelay: d3.mean(v, d => d.totalDelay),
        avgDistance: d3.mean(v, d => d.distance),
        count: v.length
      }),
      d => `${d.origin}-${d.destination}`
    );
    
    const chartData = Array.from(routeStats, ([route, stats]) => ({
      route,
      ...stats
    })).filter(d => d.count >= 5);
    
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.avgDistance) * 1.1])
      .range([margin.left, width - margin.right]);
    
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.avgDelay) * 1.1])
      .range([height - margin.bottom, margin.top]);
    
    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(chartData, d => d.count)])
      .range([3, 15]);
    
    const g = svg.append('g');
    
    g.selectAll('circle')
      .data(chartData)
      .join('circle')
      .attr('cx', d => xScale(d.avgDistance))
      .attr('cy', d => yScale(d.avgDelay))
      .attr('r', d => sizeScale(d.count))
      .attr('fill', d => d.avgDelay > 30 ? '#ef4444' : d.avgDelay > 15 ? '#f59e0b' : '#10b981')
      .attr('opacity', 0.6)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .append('title')
      .text(d => `${d.route}\nDistance: ${d.avgDistance.toFixed(0)} mi\nAvg Delay: ${d.avgDelay.toFixed(1)} min\nFlights: ${d.count}`);
    
    g.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', '11px');
    
    g.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '11px');
    
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height - 10)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Route Distance (miles)');
    
    g.append('text')
      .attr('x', margin.left - 45)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90,${margin.left - 45},${height / 2})`)
      .style('font-size', '12px')
      .text('Average Delay (minutes)');
    
    g.append('text')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', '600')
      .text('Route Efficiency: Distance vs. Delay');
  };

  const exportToCSV = () => {
    const headers = ['Carrier', 'Origin', 'Destination', 'Month', 'Total Delay', 'Carrier Delay', 'Weather Delay', 'NAS Delay', 'Cancelled'];
    const rows = filteredData.map(f => [
      f.carrier, f.origin, f.destination, f.month, f.totalDelay, 
      f.carrierDelay, f.weatherDelay, f.nasDelay, f.cancelled
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aviation-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const kpis = calculateKPIs();
  const carriers = [...new Set(data.map(d => d.carrier))].sort();
  const airports = [...new Set([...data.map(d => d.origin), ...data.map(d => d.destination)])].sort();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <BarChart3 size={32} />
                Aviation Operations Dashboard
              </h1>
              <p className="text-blue-100 mt-2">Flight Delay & Performance Analytics</p>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              <Download size={18} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Carriers</label>
              <div className="flex flex-wrap gap-2">
                {carriers.map(carrier => (
                  <button
                    key={carrier}
                    onClick={() => {
                      setSelectedCarriers(prev => 
                        prev.includes(carrier) 
                          ? prev.filter(c => c !== carrier)
                          : [...prev, carrier]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedCarriers.includes(carrier)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {carrier}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Airports</label>
              <div className="flex flex-wrap gap-2">
                {airports.slice(0, 8).map(airport => (
                  <button
                    key={airport}
                    onClick={() => {
                      setSelectedAirports(prev => 
                        prev.includes(airport) 
                          ? prev.filter(a => a !== airport)
                          : [...prev, airport]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedAirports.includes(airport)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {airport}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Month Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="11"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: parseInt(e.target.value) }))}
                  className="flex-1"
                />
                <input
                  type="range"
                  min="0"
                  max="11"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: parseInt(e.target.value) }))}
                  className="flex-1"
                />
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dateRange.start]} - {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dateRange.end]}
              </div>
            </div>
          </div>
          
          {(selectedCarriers.length > 0 || selectedAirports.length > 0) && (
            <button
              onClick={() => {
                setSelectedCarriers([]);
                setSelectedAirports([]);
                setDateRange({ start: 0, end: 11 });
              }}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">On-Time Rate</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{kpis.ontimeRate}%</p>
              </div>
              <TrendingUp className="text-green-500" size={32} />
            </div>
            <p className="text-xs text-gray-500 mt-2">&lt; 15 min delay</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Avg Delay</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{kpis.avgDelay} min</p>
              </div>
              <Clock className="text-blue-500" size={32} />
            </div>
            <p className="text-xs text-gray-500 mt-2">All flights</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Cancellation Rate</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{kpis.cancellationRate}%</p>
              </div>
              <AlertCircle className="text-red-500" size={32} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Cancelled flights</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Flights</p>
                <p className="text-3xl font-bold text-indigo-600 mt-1">{kpis.totalFlights.toLocaleString()}</p>
              </div>
              <BarChart3 className="text-indigo-500" size={32} />
            </div>
            <p className="text-xs text-gray-500 mt-2">In dataset</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md mb-6 overflow-x-auto">
          <div className="flex border-b min-w-max">
            {[
              { id: 'overview', label: 'Executive Overview' },
              { id: 'carriers', label: 'Carrier Performance' },
              { id: 'routes', label: 'Route Intelligence' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6 overflow-x-auto">
              <svg ref={delayHeatmapRef} width="600" height="250" className="max-w-full h-auto"></svg>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 overflow-x-auto">
              <svg ref={trendChartRef} width="600" height="250" className="max-w-full h-auto"></svg>
            </div>
          </div>
        )}

        {activeTab === 'carriers' && (
          <div className="bg-white rounded-lg shadow-md p-6 overflow-x-auto">
            <svg ref={carrierChartRef} width="700" height="400" className="max-w-full h-auto"></svg>
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="overflow-x-auto">
              <svg ref={routeScatterRef} width="700" height="400" className="max-w-full h-auto"></svg>
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Interpretation:</strong> Each circle represents a route. Size indicates flight frequency. 
                <span className="inline-block w-3 h-3 bg-green-500 rounded-full mx-1"></span> Green: Low delay, 
                <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mx-1"></span> Yellow: Moderate delay, 
                <span className="inline-block w-3 h-3 bg-red-500 rounded-full mx-1"></span> Red: High delay
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AviationDashboard;