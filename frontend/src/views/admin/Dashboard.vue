<template>
  <div class="dashboard">
    <h1 class="page-title">📊 数据概览</h1>
    
    <div class="stats-grid">
      <div class="stat-card card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats?.total_orders || 0 }}</div>
          <div class="stat-label">总订单数</div>
        </div>
      </div>
      <div class="stat-card card">
        <div class="stat-icon">💰</div>
        <div class="stat-content">
          <div class="stat-value">¥{{ stats?.total_revenue || 0 }}</div>
          <div class="stat-label">总营收</div>
        </div>
      </div>
      <div class="stat-card card">
        <div class="stat-icon">🎥</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats?.total_movies || 0 }}</div>
          <div class="stat-label">上映影片</div>
        </div>
      </div>
      <div class="stat-card card">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats?.total_users || 0 }}</div>
          <div class="stat-label">注册用户</div>
        </div>
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-header">
        <h2>📈 订单统计</h2>
        <div class="chart-tabs">
          <button 
            class="tab-btn" 
            :class="{ active: chartType === 'daily' }"
            @click="chartType = 'daily'"
          >
            近7天
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: chartType === 'monthly' }"
            @click="chartType = 'monthly'"
          >
            近12个月
          </button>
        </div>
      </div>
      <div class="chart-card card">
        <div ref="orderChartRef" class="chart"></div>
      </div>
    </div>

    <div class="movie-sales-section">
      <h2>🎬 影片销售排行</h2>
      <div class="chart-card card">
        <div ref="movieChartRef" class="chart"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { getDashboardStats, getOrderStats } from '../../api/admin'

const stats = ref(null)
const chartType = ref('daily')
const orderChartRef = ref(null)
const movieChartRef = ref(null)

let orderChart = null
let movieChart = null

const loadStats = async () => {
  try {
    const res = await getDashboardStats()
    stats.value = res.stats
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

const loadOrderStats = async () => {
  try {
    const res = await getOrderStats({ type: chartType.value })
    renderOrderChart(res.stats)
    renderMovieChart(res.movie_sales)
  } catch (error) {
    console.error('加载订单统计失败:', error)
  }
}

const renderOrderChart = (data) => {
  if (!orderChartRef.value) return
  
  if (!orderChart) {
    orderChart = echarts.init(orderChartRef.value)
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: {
        color: '#e0e0e0'
      }
    },
    legend: {
      data: ['订单数', '营收'],
      textStyle: {
        color: '#aaa'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLine: {
        lineStyle: {
          color: '#444'
        }
      },
      axisLabel: {
        color: '#888'
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '订单数',
        axisLine: {
          lineStyle: {
            color: '#444'
          }
        },
        axisLabel: {
          color: '#888'
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)'
          }
        }
      },
      {
        type: 'value',
        name: '营收(元)',
        axisLine: {
          lineStyle: {
            color: '#444'
          }
        },
        axisLabel: {
          color: '#888'
        },
        splitLine: {
          show: false
        }
      }
    ],
    series: [
      {
        name: '订单数',
        type: 'bar',
        data: data.map(d => d.order_count),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#e94560' },
            { offset: 1, color: '#ff6b6b' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: '营收',
        type: 'line',
        yAxisIndex: 1,
        data: data.map(d => d.revenue),
        smooth: true,
        lineStyle: {
          color: '#51cf66',
          width: 3
        },
        itemStyle: {
          color: '#51cf66'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(81, 207, 102, 0.3)' },
            { offset: 1, color: 'rgba(81, 207, 102, 0.05)' }
          ])
        }
      }
    ]
  }

  orderChart.setOption(option)
}

const renderMovieChart = (data) => {
  if (!movieChartRef.value) return
  
  if (!movieChart) {
    movieChart = echarts.init(movieChartRef.value)
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: {
        color: '#e0e0e0'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: '#444'
        }
      },
      axisLabel: {
        color: '#888'
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.05)'
        }
      }
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d.movie_name).reverse(),
      axisLine: {
        lineStyle: {
          color: '#444'
        }
      },
      axisLabel: {
        color: '#e0e0e0'
      }
    },
    series: [
      {
        name: '营收',
        type: 'bar',
        data: data.map(d => d.revenue).reverse(),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#e94560' },
            { offset: 1, color: '#ff6b6b' }
          ]),
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: 'right',
          color: '#e0e0e0',
          formatter: '¥{c}'
        }
      }
    ]
  }

  movieChart.setOption(option)
}

const handleResize = () => {
  orderChart?.resize()
  movieChart?.resize()
}

watch(chartType, () => {
  loadOrderStats()
})

onMounted(async () => {
  await loadStats()
  await nextTick()
  await loadOrderStats()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  orderChart?.dispose()
  movieChart?.dispose()
})
</script>

<style scoped>
.dashboard {
  min-height: 100%;
}

.page-title {
  font-size: 24px;
  color: #e0e0e0;
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
}

.stat-icon {
  font-size: 40px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #e94560;
  margin-bottom: 4px;
}

.stat-label {
  color: #888;
  font-size: 14px;
}

.chart-section,
.movie-sales-section {
  margin-bottom: 32px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header h2,
.movie-sales-section h2 {
  font-size: 18px;
  color: #e0e0e0;
}

.chart-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #888;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab-btn.active {
  background: #e94560;
  color: white;
}

.chart-card {
  padding: 20px;
}

.chart {
  width: 100%;
  height: 350px;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
