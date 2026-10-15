const Course = require('../models/course');
const Subject = require('../models/subject');
exports.getAllCourses = async (req, res) => { try { const data = await Course.find(); res.json(data); } catch(err) { res.status(500).json({error: err.message}); } };
exports.createCourse = async (req, res) => { try { const data = new Course(req.body); await data.save(); res.status(201).json(data); } catch(err) { res.status(500).json({error: err.message}); } };
exports.getAllSubjects = async (req, res) => { try { const data = await Subject.find(); res.json(data); } catch(err) { res.status(500).json({error: err.message}); } };
exports.createSubject = async (req, res) => { try { const data = new Subject(req.body); await data.save(); res.status(201).json(data); } catch(err) { res.status(500).json({error: err.message}); } };
