const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { isSuperRole } = require('../middleware/hideSuperAdminData');

const router = express.Router();

function isSchemaError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    err?.code === 'ER_BAD_FIELD_ERROR' ||
    err?.code === 'ER_NO_SUCH_TABLE' ||
    msg.includes('unknown column') ||
    msg.includes("doesn't exist") ||
    msg.includes('no such table')
  );
}

async function runVariants(variants, fallback = []) {
  let lastSchemaError = null;
  for (const variant of variants) {
    try {
      return await query(variant.sql, variant.params || []);
    } catch (err) {
      if (isSchemaError(err)) {
        lastSchemaError = err;
        continue;
      }
      throw err;
    }
  }
  if (lastSchemaError) return fallback;
  return fallback;
}

function firstRow(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function buildMonthSeries(monthCount = 6) {
  const now = new Date();
  const months = [];
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = date.toISOString().slice(0, 7);
    months.push({
      key,
      month: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      meetings: 0,
      tasks: 0,
    });
  }
  return months;
}

function mergeMonthlyCounts(series, rows, field) {
  const lookup = new Map((rows || []).map((row) => [String(row.month_key || row.month || '').slice(0, 7), asNumber(row.count)]));
  return series.map((item) => ({
    ...item,
    [field]: lookup.get(item.key) || 0,
  }));
}

function mapStatusRows(rows) {
  return (rows || []).map((row) => ({
    status: String(row.status || row.report_type || 'unknown'),
    count: asNumber(row.count),
  }));
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const employee = req.employee || {};
    const employeeId = employee.id;
    const companyId = employee.company_id;
    const hasCompanyId = companyId !== null && companyId !== undefined;
    const isSuper = isSuperRole(employee.role);
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;

    const leadMetricVariants = isSuper
      ? [
          {
            sql: `
              SELECT
                COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0) AS new_count,
                COALESCE(SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END), 0) AS contacted_count,
                COALESCE(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END), 0) AS won_count,
                COALESCE(SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END), 0) AS lost_count,
                COALESCE(ROUND(AVG(COALESCE(lead_score, 0)), 0), 0) AS avg_score,
                COALESCE(SUM(COALESCE(estimated_value, 0)), 0) AS deal_value
              FROM leads
            `,
            params: [],
          },
        ]
      : [
          hasCompanyId && {
            sql: `
              SELECT
                COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0) AS new_count,
                COALESCE(SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END), 0) AS contacted_count,
                COALESCE(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END), 0) AS won_count,
                COALESCE(SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END), 0) AS lost_count,
                COALESCE(ROUND(AVG(COALESCE(lead_score, 0)), 0), 0) AS avg_score,
                COALESCE(SUM(COALESCE(estimated_value, 0)), 0) AS deal_value
              FROM leads
              WHERE company_id = ?
            `,
            params: [companyId],
          },
          {
            sql: `
              SELECT
                COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0) AS new_count,
                COALESCE(SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END), 0) AS contacted_count,
                COALESCE(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END), 0) AS won_count,
                COALESCE(SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END), 0) AS lost_count,
                COALESCE(ROUND(AVG(COALESCE(lead_score, 0)), 0), 0) AS avg_score,
                COALESCE(SUM(COALESCE(estimated_value, 0)), 0) AS deal_value
              FROM leads
              WHERE assigned_to = ?
            `,
            params: [employeeId],
          },
          {
            sql: `
              SELECT
                COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0) AS new_count,
                COALESCE(SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END), 0) AS contacted_count,
                COALESCE(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END), 0) AS won_count,
                COALESCE(SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END), 0) AS lost_count,
                COALESCE(ROUND(AVG(COALESCE(lead_score, 0)), 0), 0) AS avg_score,
                COALESCE(SUM(COALESCE(estimated_value, 0)), 0) AS deal_value
              FROM leads
              WHERE employee_id = ?
            `,
            params: [employeeId],
          },
        ].filter(Boolean);

    const leadStatusVariants = isSuper
      ? [
          {
            sql: `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM leads GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC`,
            params: [],
          },
        ]
      : [
          hasCompanyId && {
            sql: `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM leads WHERE company_id = ? GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC`,
            params: [companyId],
          },
          {
            sql: `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM leads WHERE assigned_to = ? GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC`,
            params: [employeeId],
          },
          {
            sql: `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM leads WHERE employee_id = ? GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC`,
            params: [employeeId],
          },
        ].filter(Boolean);

    const taskCountVariants = [
      {
        sql: 'SELECT COUNT(*) AS count FROM tasks WHERE employee_id = ? AND status != ?',
        params: [employeeId, 'completed'],
      },
      {
        sql: 'SELECT COUNT(*) AS count FROM tasks WHERE employee_id = ?',
        params: [employeeId],
      },
    ];

    const completedTodayVariants = [
      {
        sql: 'SELECT COUNT(*) AS count FROM tasks WHERE employee_id = ? AND status = ? AND DATE(COALESCE(completed_at, updated_at, created_at)) = ?',
        params: [employeeId, 'completed', today],
      },
      {
        sql: 'SELECT COUNT(*) AS count FROM tasks WHERE employee_id = ? AND DATE(COALESCE(completed_at, updated_at, created_at)) = ?',
        params: [employeeId, today],
      },
    ];

    const meetingTodayVariants = [
      {
        sql: 'SELECT COUNT(*) AS count FROM meetings WHERE employee_id = ? AND DATE(meeting_date) >= ?',
        params: [employeeId, today],
      },
      {
        sql: 'SELECT COUNT(*) AS count FROM meetings WHERE employee_id = ?',
        params: [employeeId],
      },
    ];

    const meetingMonthVariants = [
      {
        sql: "SELECT COUNT(*) AS count FROM meetings WHERE employee_id = ? AND DATE_FORMAT(meeting_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')",
        params: [employeeId],
      },
      {
        sql: 'SELECT COUNT(*) AS count FROM meetings WHERE employee_id = ?',
        params: [employeeId],
      },
    ];

    const followupVariants = [
      {
        sql: "SELECT COUNT(*) AS count FROM followups WHERE employee_id = ? AND status != 'completed'",
        params: [employeeId],
      },
      {
        sql: "SELECT COUNT(*) AS count FROM followups WHERE employee_id = ? AND (status IS NULL OR status != 'completed')",
        params: [employeeId],
      },
    ];

    const docCountVariants = (table, employeeFallback = 'employee_id') => {
      const variants = [];
      if (!isSuper) {
        if (companyId !== null && companyId !== undefined) {
          variants.push({ sql: `SELECT COUNT(*) AS count FROM ${table} WHERE company_id = ?`, params: [companyId] });
        }
        variants.push({ sql: `SELECT COUNT(*) AS count FROM ${table} WHERE ${employeeFallback} = ?`, params: [employeeId] });
        variants.push({ sql: `SELECT COUNT(*) AS count FROM ${table} WHERE created_by = ?`, params: [employeeId] });
      }
      variants.push({ sql: `SELECT COUNT(*) AS count FROM ${table}`, params: [] });
      return variants;
    };

    const docStatusVariants = (table, employeeFallback = 'employee_id') => {
      const variants = [];
      if (!isSuper) {
        if (companyId !== null && companyId !== undefined) {
          variants.push({
            sql: `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM ${table} WHERE company_id = ? GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC`,
            params: [companyId],
          });
        }
        variants.push({
          sql: `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM ${table} WHERE ${employeeFallback} = ? GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC`,
          params: [employeeId],
        });
        variants.push({
          sql: `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM ${table} WHERE created_by = ? GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC`,
          params: [employeeId],
        });
      }
      variants.push({
        sql: `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM ${table} GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC`,
        params: [],
      });
      return variants;
    };

    const docAmountVariants = (table, employeeFallback = 'employee_id') => {
      const variants = [];
      if (!isSuper) {
        if (companyId !== null && companyId !== undefined) {
          variants.push({
            sql: `SELECT COALESCE(SUM(total_amount), 0) AS total FROM ${table} WHERE company_id = ? AND status = 'paid'`,
            params: [companyId],
          });
        }
        variants.push({
          sql: `SELECT COALESCE(SUM(total_amount), 0) AS total FROM ${table} WHERE ${employeeFallback} = ? AND status = 'paid'`,
          params: [employeeId],
        });
        variants.push({
          sql: `SELECT COALESCE(SUM(total_amount), 0) AS total FROM ${table} WHERE created_by = ? AND status = 'paid'`,
          params: [employeeId],
        });
      }
      variants.push({ sql: `SELECT COALESCE(SUM(total_amount), 0) AS total FROM ${table} WHERE status = 'paid'`, params: [] });
      return variants;
    };

    const leadRow = firstRow(await runVariants(leadMetricVariants, []));
    const leadStatusRows = mapStatusRows(await runVariants(leadStatusVariants, []));
    const taskRow = firstRow(await runVariants(taskCountVariants, []));
    const completedTodayRow = firstRow(await runVariants(completedTodayVariants, []));
    const meetingTodayRow = firstRow(await runVariants(meetingTodayVariants, []));
    const meetingMonthRow = firstRow(await runVariants(meetingMonthVariants, []));
    const followupRow = firstRow(await runVariants(followupVariants, []));

    const quotationRow = firstRow(await runVariants(docCountVariants('quotations', 'employee_id'), []));
    const quotationStatusRows = mapStatusRows(await runVariants(docStatusVariants('quotations', 'employee_id'), []));

    const invoiceRow = firstRow(await runVariants(docCountVariants('invoices', 'employee_id'), []));
    const invoiceStatusRows = mapStatusRows(await runVariants(docStatusVariants('invoices', 'employee_id'), []));
    const invoiceAmountRow = firstRow(await runVariants(docAmountVariants('invoices', 'employee_id'), []));

    const salesOrderRow = firstRow(await runVariants(docCountVariants('sales_orders', 'created_by'), []));
    const salesOrderStatusRows = mapStatusRows(await runVariants(docStatusVariants('sales_orders', 'created_by'), []));

    const reportRow = firstRow(
      await runVariants(
        [
          {
            sql: 'SELECT COUNT(*) AS count FROM reports WHERE employee_id = ?',
            params: [employeeId],
          },
          {
            sql: 'SELECT COUNT(*) AS count FROM reports',
            params: [],
          },
        ],
        []
      )
    );
    const reportTypeRows = mapStatusRows(
      await runVariants(
        [
          {
            sql: "SELECT COALESCE(report_type, 'unknown') AS report_type, COUNT(*) AS count FROM reports WHERE employee_id = ? GROUP BY COALESCE(report_type, 'unknown') ORDER BY count DESC",
            params: [employeeId],
          },
          {
            sql: "SELECT COALESCE(report_type, 'unknown') AS report_type, COUNT(*) AS count FROM reports GROUP BY COALESCE(report_type, 'unknown') ORDER BY count DESC",
            params: [],
          },
        ],
        []
      )
    );

    const whatsappRow = firstRow(
      await runVariants(
        [
          hasCompanyId && { sql: 'SELECT COUNT(*) AS count FROM whatsapp_hits WHERE company_id = ?', params: [companyId] },
          { sql: 'SELECT COUNT(*) AS count FROM whatsapp_hits WHERE employee_id = ?', params: [employeeId] },
          { sql: 'SELECT COUNT(*) AS count FROM whatsapp_hits', params: [] },
        ].filter(Boolean),
        []
      )
    );

    const whatsappStatusRows = mapStatusRows(
      await runVariants(
        [
          hasCompanyId && {
            sql: "SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM whatsapp_hits WHERE company_id = ? GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC",
            params: [companyId],
          },
          {
            sql: "SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM whatsapp_hits WHERE employee_id = ? GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC",
            params: [employeeId],
          },
          {
            sql: "SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS count FROM whatsapp_hits GROUP BY COALESCE(status, 'unknown') ORDER BY count DESC",
            params: [],
          },
        ].filter(Boolean),
        []
      )
    );

    const monthlySeries = buildMonthSeries(6);
    const meetingMonths = await runVariants(
      [
        {
          sql: "SELECT DATE_FORMAT(meeting_date, '%Y-%m') AS month_key, COUNT(*) AS count FROM meetings WHERE employee_id = ? GROUP BY DATE_FORMAT(meeting_date, '%Y-%m') ORDER BY month_key ASC",
          params: [employeeId],
        },
        {
          sql: "SELECT DATE_FORMAT(meeting_date, '%Y-%m') AS month_key, COUNT(*) AS count FROM meetings GROUP BY DATE_FORMAT(meeting_date, '%Y-%m') ORDER BY month_key ASC",
          params: [],
        },
      ],
      []
    );
    const taskMonths = await runVariants(
      [
        {
          sql: "SELECT DATE_FORMAT(COALESCE(completed_at, updated_at, created_at), '%Y-%m') AS month_key, COUNT(*) AS count FROM tasks WHERE employee_id = ? GROUP BY DATE_FORMAT(COALESCE(completed_at, updated_at, created_at), '%Y-%m') ORDER BY month_key ASC",
          params: [employeeId],
        },
        {
          sql: "SELECT DATE_FORMAT(COALESCE(completed_at, updated_at, created_at), '%Y-%m') AS month_key, COUNT(*) AS count FROM tasks GROUP BY DATE_FORMAT(COALESCE(completed_at, updated_at, created_at), '%Y-%m') ORDER BY month_key ASC",
          params: [],
        },
      ],
      []
    );
    const monthlyActivity = mergeMonthlyCounts(mergeMonthlyCounts(monthlySeries, meetingMonths, 'meetings'), taskMonths, 'tasks');

    const recentActivityRows = await runVariants(
        [
          hasCompanyId && {
            sql: `
            SELECT a.id, a.activity_type, a.description, a.created_at, e.name AS employee_name
            FROM activity_logs a
            LEFT JOIN employees e ON e.id = a.employee_id
            WHERE e.company_id = ?
            ORDER BY a.created_at DESC
            LIMIT 10
            `,
            params: [companyId],
          },
          {
            sql: `
            SELECT a.id, a.activity_type, a.description, a.created_at, e.name AS employee_name
            FROM activity_logs a
            LEFT JOIN employees e ON e.id = a.employee_id
            WHERE a.employee_id = ?
            ORDER BY a.created_at DESC
            LIMIT 10
          `,
          params: [employeeId],
        },
        {
          sql: `
            SELECT a.id, a.activity_type, a.description, a.created_at, e.name AS employee_name
            FROM activity_logs a
            LEFT JOIN employees e ON e.id = a.employee_id
            ORDER BY a.created_at DESC
            LIMIT 10
            `,
            params: [],
          },
        ].filter(Boolean),
        []
      );

    const targetRows = await runVariants(
      [
        {
          sql: `
            SELECT target_value, metric_type
            FROM employee_targets
            WHERE user_id = ? AND period_month = ? AND period_year = ?
            ORDER BY id DESC
            LIMIT 1
          `,
          params: [employeeId, new Date().getMonth() + 1, new Date().getFullYear()],
        },
      ],
      []
    );
    const targetRow = firstRow(targetRows);

    const totalLeads = asNumber(leadRow.total);
    const totalQuotations = asNumber(quotationRow.count);
    const totalInvoices = asNumber(invoiceRow.count);
    const totalSalesOrders = asNumber(salesOrderRow.count);
    const totalReports = asNumber(reportRow.count);
    const totalWhatsapp = asNumber(whatsappRow.count);
    const totalInvoiceAmount = asNumber(invoiceAmountRow.total);
    const pendingTasks = asNumber(taskRow.count);
    const todayTasksCompleted = asNumber(completedTodayRow.count);
    const todayMeetings = asNumber(meetingTodayRow.count);
    const monthMeetings = asNumber(meetingMonthRow.count);
    const pendingFollowups = asNumber(followupRow.count);
    const avgLeadScore = asNumber(leadRow.avg_score);
    const dealValue = asNumber(leadRow.deal_value);

    const targetValue = asNumber(targetRow.target_value);
    const metricType = String(targetRow.metric_type || 'leads').toLowerCase();
    const achievedByMetric = {
      leads: totalLeads,
      quotations: totalQuotations,
      invoices: totalInvoices,
      sales_orders: totalSalesOrders,
      sales: totalInvoiceAmount,
      revenue: totalInvoiceAmount,
      invoice_amount: totalInvoiceAmount,
      deal_value: dealValue,
      payments: totalInvoiceAmount,
    };
    const achievedValue = achievedByMetric[metricType] ?? totalLeads;
    const targetData = targetValue > 0
      ? {
          target_value: targetValue,
          achieved_value: achievedValue,
          remaining: Math.max(targetValue - achievedValue, 0),
          progress_percentage: Math.min(100, Math.round((achievedValue / targetValue) * 100)),
          metric_type: metricType,
        }
      : null;

    return res.json({
      success: true,
      data: {
        total_leads: totalLeads,
        leads_by_status: leadStatusRows,
        today_meetings: todayMeetings,
        month_meetings: monthMeetings,
        today_tasks_completed: todayTasksCompleted,
        pending_tasks: pendingTasks,
        deal_value: dealValue,
        pending_followups: pendingFollowups,
        avg_lead_score: avgLeadScore,
        total_quotations: totalQuotations,
        quotations_by_status: quotationStatusRows,
        total_invoices: totalInvoices,
        invoices_by_status: invoiceStatusRows,
        total_invoice_amount: totalInvoiceAmount,
        total_sales_orders: totalSalesOrders,
        sales_orders_by_status: salesOrderStatusRows,
        total_reports: totalReports,
        reports_by_type: reportTypeRows,
        total_whatsapp: totalWhatsapp,
        whatsapp_by_status: whatsappStatusRows,
        monthly_activity: monthlyActivity,
        recent_activities: recentActivityRows,
        target_data: targetData,
      },
    });
  } catch (err) {
    console.error('Dashboard:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
