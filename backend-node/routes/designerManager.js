const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const eid = req.employee.id;

    // 1. Top Section Metrics
    const [activeProjectsRes] = await query("SELECT COUNT(*) as c FROM tasks WHERE company_id = ? WHERE status IN ('pending', 'in_progress') AND task_type = 'design'");
    const [teamWorkloadRes] = await query("SELECT COUNT(*) as c FROM tasks WHERE company_id = ? WHERE status = 'in_progress' AND task_type = 'design'");
    const [pendingReviewsRes] = await query("SELECT COUNT(*) as c FROM tasks WHERE company_id = ? WHERE status = 'under_review' AND task_type = 'design'");
    const [designRequestsRes] = await query("SELECT COUNT(*) as c FROM tasks WHERE company_id = ? WHERE status = 'pending' AND task_type = 'design'");

    const activeProjects = Number(activeProjectsRes?.c) || 0;
    const teamWorkload = Number(teamWorkloadRes?.c) || 0;
    const pendingReviews = Number(pendingReviewsRes?.c) || 0;
    const designRequests = Number(designRequestsRes?.c) || 0;

    // 2. Middle Section: Task Productivity Chart (Dummy data matching theme)
    const productivityTrends = [
      { month: 'Jan', count: 12 }, { month: 'Feb', count: 19 }, { month: 'Mar', count: 15 },
      { month: 'Apr', count: 22 }, { month: 'May', count: 28 }, { month: 'Jun', count: 24 }
    ];

    // Project Progress Overview
    const projectProgress = [
      { name: 'Branding Project A', progress: 75 },
      { name: 'Website Redesign', progress: 40 },
      { name: 'Social Media Assets', progress: 90 },
      { name: 'Marketing Campaign', progress: 20 }
    ];

    // 3. Bottom Section: Recent Assignments
    const recentAssignments = await query(`
      SELECT t.id, t.title, t.status, e.name as assigned_to
      FROM tasks t
      LEFT JOIN employees e ON t.employee_id = e.id
      WHERE t.task_type = 'design' OR t.task_type IS NULL
      ORDER BY t.created_at DESC LIMIT 5
    `).catch(() => []);

    // Recent Activities
    const recentActivities = await query(`
        SELECT description, created_at as date, activity_type as type 
        FROM activity_logs 
        ORDER BY created_at DESC LIMIT 5
    `).catch(() => []);

    // Critical Deadlines
    const criticalDeadlines = await query(`
        SELECT id, title, due_date, priority 
        FROM tasks 
        WHERE status != 'completed' AND priority IN ('high', 'urgent') 
        ORDER BY due_date ASC LIMIT 5
    `).catch(() => []);


    return res.json({
      success: true,
      data: {
        stats: {
          active_projects: activeProjects,
          team_workload: teamWorkload,
          pending_reviews: pendingReviews,
          design_requests: designRequests
        },
        productivity_trends: productivityTrends,
        project_progress: projectProgress,
        recent_assignments: recentAssignments,
        recent_activities: recentActivities,
        critical_deadlines: criticalDeadlines
      },
    });
  } catch (err) {
      console.error('Designer Manager dashboard error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
