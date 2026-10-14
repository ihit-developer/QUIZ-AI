import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, ChevronDown, CirclePlay, ClipboardCheck, Crown, QrCode, Sparkles, UsersRound, Wand2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const features = [
  { icon: Wand2, title: 'Build with confidence', copy: 'Create assessments in the guided builder or generate question drafts from a topic with the existing AI workspace.' },
  { icon: UsersRound, title: 'Run live or self-paced', copy: 'Launch a synchronized Live Arena or share a self-paced assessment with its existing attempt rules and due date.' },
  { icon: BarChart3, title: 'Understand outcomes', copy: 'Review real quiz attempts, results, host analytics, and participant performance insights in one place.' },
];
const faqs = [
  ['How do learners join?', 'Learners can enter a host’s join code or open a shared quiz link. Live rooms open when the host starts the session.'],
  ['Can I create a self-paced quiz?', 'Yes. Hosts can publish a self-paced assessment and configure its existing duration, attempt, and schedule settings.'],
  ['What happens in a live quiz?', 'The host controls the room while participants answer synchronized questions and see the live leaderboard and final result.'],
];

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const join = (event) => { event.preventDefault(); if (code.trim()) navigate(`/join/${code.trim().toUpperCase()}`); };
  const host = user?.role === 'host' || user?.role === 'admin';
  return <div className="landing-page">
    <section className="landing-hero">
      <div className="landing-hero-copy">
        <span className="landing-kicker"><Sparkles size={14} /> Assessment workspace</span>
        <h1>Make every quiz<br /><em>clear, active, and useful.</em></h1>
        <p>Quizese brings quiz creation, live participation, and performance review into one focused workspace for hosts and learners.</p>
        {host ? <div className="landing-actions"><Link className="btn-primary" to="/create-quiz">Create a quiz <ArrowRight size={17} /></Link><Link className="landing-text-link" to="/dashboard">Open workspace</Link></div> : <form className="landing-join" onSubmit={join}><QrCode size={20} /><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="Enter a quiz code" aria-label="Quiz join code" /><button className="btn-primary" type="submit">Join <ArrowRight size={16} /></button></form>}
        {!user && <p className="landing-note">Want to create quizzes? <Link to="/register">Create a host account</Link>.</p>}
      </div>
      <div className="landing-visual" aria-hidden="true">
        <div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" />
        <div className="visual-window"><div className="visual-window-bar"><span /><span /><span /></div><div className="visual-body"><div className="visual-title" /><div className="visual-question">Which experience would you like to run?</div><div className="visual-option selected"><CheckCircle2 size={17} /> Live room</div><div className="visual-option">Self-paced assessment</div></div></div>
        <div className="visual-score"><Crown size={18} /><div><small>LIVE SCORE</small><strong>240 pts</strong></div></div>
        <div className="visual-progress"><ClipboardCheck size={18} /><span>Results saved</span><b>100%</b></div>
      </div>
    </section>
    <section className="landing-trust"><span>ONE WORKSPACE</span><i /><span>LIVE ROOMS</span><i /><span>SELF-PACED QUIZZES</span><i /><span>REAL RESULTS</span></section>
    <section className="landing-section"><div className="landing-section-heading"><span>HOW QUIZESE WORKS</span><h2>A calmer way to run assessments.</h2><p>Use the capabilities already in your workspace without adding another system to manage.</p></div><div className="landing-feature-grid">{features.map(({ icon: Icon, title, copy }, index) => <article className="landing-feature" key={title}><span className="feature-index">0{index + 1}</span><Icon size={25} /><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="landing-flow"><div><span>FROM SETUP TO REVIEW</span><h2>Create, share, then learn from real attempts.</h2></div><div className="landing-flow-steps"><p><b>01</b> Set up questions and quiz settings.</p><p><b>02</b> Share a code or launch your room.</p><p><b>03</b> Review results and analytics.</p></div></section>
    <section className="landing-faq"><div className="landing-section-heading"><span>HELPFUL DETAILS</span><h2>Questions, answered.</h2></div>{faqs.map(([question, answer], index) => <div className="faq-row" key={question}><button onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><ChevronDown size={18} className={openFaq === index ? 'rotate' : ''} /></button>{openFaq === index && <p>{answer}</p>}</div>)}</section>
  </div>;
};
