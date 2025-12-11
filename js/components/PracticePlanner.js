/**
 * Practice Planner Component
 * Comprehensive practice session planning with Bieler technique tasks
 */

import { 
  loadPracticePlan, 
  savePracticePlan 
} from '../config/storage.js';
import { 
  awardXP, 
  incrementDailyItems 
} from '../engines/gamification.js';
import { TECHNIQUE_TASKS } from '../config/constants.js';

// Use React from the global UMD bundle
const { useState, useEffect } = React;

export default function PracticePlanner({ navigate, showToast }) {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('custom');
  const [selectedTask, setSelectedTask] = useState('');

  useEffect(() => {
    setItems(loadPracticePlan());
  }, []);

  useEffect(() => {
    savePracticePlan(items);
  }, [items]);

  const addCustomItem = () => {
    if (!newItemName.trim()) return;
    
    const newItem = {
      id: Date.now(),
      name: newItemName.trim(),
      type: 'custom',
      completed: false,
      addedDate: new Date().toISOString()
    };
    
    setItems([...items, newItem]);
    setNewItemName('');
    showToast('Added to practice plan', 'success');
  };

  const addTechniqueTask = () => {
    if (!selectedTask) return;
    
    const task = TECHNIQUE_TASKS.find(t => t.id === selectedTask);
    if (!task) return;
    
    const newItem = {
      id: Date.now(),
      name: task.name,
      description: task.description,
      bielerRef: task.bielerRef,
      type: 'technique',
      category: task.category,
      completed: false,
      addedDate: new Date().toISOString()
    };
    
    setItems([...items, newItem]);
    setSelectedTask('');
    showToast('Added technique task', 'success');
  };

  const toggleComplete = (id) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newCompleted = !item.completed;
        
        if (newCompleted) {
          // Award XP for completing item
          const result = awardXP(5, `Completed: ${item.name}`);
          incrementDailyItems();
          showToast(`+5 XP • ${item.name} completed!`, 'success');
        }
        
        return { ...item, completed: newCompleted };
      }
      return item;
    }));
  };

  const deleteItem = (id) => {
    if (confirm('Remove this item from your practice plan?')) {
      setItems(items.filter(item => item.id !== id));
      showToast('Item removed', 'info');
    }
  };

  const clearCompleted = () => {
    if (confirm('Clear all completed items?')) {
      setItems(items.filter(item => !item.completed));
      showToast('Completed items cleared', 'info');
    }
  };

  const categories = {
    lefthand: 'Left Hand',
    righthand: 'Right Hand',
    bowstroke: 'Bow Strokes'
  };

  const pendingItems = items.filter(i => !i.completed);
  const completedItems = items.filter(i => i.completed);

  return React.createElement('div', { className: 'container' },
    React.createElement('h2', null, '📝 Practice Planner'),
    React.createElement('p', null, 'Build your personalized practice session with technique tasks and repertoire.'),
    
    // Add Items Section
    React.createElement('div', { className: 'card', style: { marginBottom: '20px' } },
      React.createElement('h3', null, 'Add to Practice Plan'),
      
      // Tabs
      React.createElement('div', {
        style: {
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '2px solid #dee2e6'
        }
      },
        React.createElement('button', {
          className: selectedCategory === 'custom' ? 'btn-primary' : 'btn-outline',
          style: { borderRadius: '4px 4px 0 0' },
          onClick: () => setSelectedCategory('custom')
        }, 'Custom Item'),
        
        React.createElement('button', {
          className: selectedCategory === 'technique' ? 'btn-primary' : 'btn-outline',
          style: { borderRadius: '4px 4px 0 0' },
          onClick: () => setSelectedCategory('technique')
        }, 'Technique Task')
      ),
      
      // Custom Item Form
      selectedCategory === 'custom' && React.createElement('div', null,
        React.createElement('input', {
          type: 'text',
          value: newItemName,
          onChange: (e) => setNewItemName(e.target.value),
          onKeyDown: (e) => e.key === 'Enter' && addCustomItem(),
          placeholder: 'e.g., Bach Concerto - 1st movement, Sevcik Op. 1 No. 1',
          style: { width: '100%', padding: '8px', marginBottom: '12px' }
        }),
        React.createElement('button', {
          className: 'btn-primary',
          onClick: addCustomItem
        }, '+ Add Custom Item')
      ),
      
      // Technique Task Form
      selectedCategory === 'technique' && React.createElement('div', null,
        React.createElement('select', {
          value: selectedTask,
          onChange: (e) => setSelectedTask(e.target.value),
          style: { width: '100%', padding: '8px', marginBottom: '12px' }
        },
          React.createElement('option', { value: '' }, '-- Select Technique Task --'),
          Object.entries(categories).map(([catKey, catName]) => [
            React.createElement('optgroup', { key: catKey, label: catName },
              TECHNIQUE_TASKS
                .filter(t => t.category === catKey)
                .map(task =>
                  React.createElement('option', { key: task.id, value: task.id }, task.name)
                )
            )
          ])
        ),
        
        selectedTask && (() => {
          const task = TECHNIQUE_TASKS.find(t => t.id === selectedTask);
          return task && React.createElement('div', {
            style: {
              padding: '12px',
              background: '#f8f9fa',
              borderRadius: '8px',
              marginBottom: '12px'
            }
          },
            React.createElement('strong', null, task.name),
            React.createElement('p', { className: 'small', style: { margin: '8px 0 0' } }, task.description),
            task.bielerRef && React.createElement('p', {
              className: 'small',
              style: { margin: '4px 0 0', color: '#007bff', fontStyle: 'italic' }
            }, `Bieler: ${task.bielerRef}`)
          );
        })(),
        
        React.createElement('button', {
          className: 'btn-primary',
          onClick: addTechniqueTask,
          disabled: !selectedTask
        }, '+ Add Technique Task')
      )
    ),
    
    // Practice List
    React.createElement('div', { className: 'card' },
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }
      },
        React.createElement('h3', { style: { margin: 0 } }, 'Today\'s Practice'),
        completedItems.length > 0 && React.createElement('button', {
          className: 'btn-outline',
          style: { fontSize: '0.85rem' },
          onClick: clearCompleted
        }, 'Clear Completed')
      ),
      
      // Pending Items
      pendingItems.length === 0 && completedItems.length === 0 && 
        React.createElement('p', { style: { color: '#6c757d', textAlign: 'center', padding: '32px 0' } },
          'No practice items yet. Add some above to get started!'
        ),
      
      pendingItems.length > 0 && React.createElement('div', { style: { marginBottom: '24px' } },
        React.createElement('h4', { style: { fontSize: '0.9rem', color: '#6c757d', marginBottom: '12px' } },
          `TO PRACTICE (${pendingItems.length})`
        ),
        pendingItems.map(item =>
          React.createElement('div', {
            key: item.id,
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px',
              background: '#f8f9fa',
              borderRadius: '8px',
              marginBottom: '8px'
            }
          },
            React.createElement('input', {
              type: 'checkbox',
              checked: item.completed,
              onChange: () => toggleComplete(item.id),
              style: { marginTop: '4px', cursor: 'pointer' }
            }),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontWeight: 'bold' } }, item.name),
              item.description && React.createElement('div', {
                className: 'small',
                style: { color: '#6c757d', marginTop: '4px' }
              }, item.description),
              item.bielerRef && React.createElement('div', {
                className: 'small',
                style: { color: '#007bff', marginTop: '4px', fontStyle: 'italic' }
              }, `Bieler: ${item.bielerRef}`)
            ),
            React.createElement('button', {
              className: 'btn-danger',
              style: { padding: '4px 8px', fontSize: '0.85rem' },
              onClick: () => deleteItem(item.id)
            }, '×')
          )
        )
      ),
      
      // Completed Items
      completedItems.length > 0 && React.createElement('div', null,
        React.createElement('h4', {
          style: {
            fontSize: '0.9rem',
            color: '#28a745',
            marginBottom: '12px',
            marginTop: '24px'
          }
        }, `✓ COMPLETED (${completedItems.length})`),
        completedItems.map(item =>
          React.createElement('div', {
            key: item.id,
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px',
              background: '#d4edda',
              borderRadius: '8px',
              marginBottom: '8px',
              opacity: 0.8
            }
          },
            React.createElement('input', {
              type: 'checkbox',
              checked: item.completed,
              onChange: () => toggleComplete(item.id),
              style: { marginTop: '4px', cursor: 'pointer' }
            }),
            React.createElement('div', {
              style: {
                flex: 1,
                textDecoration: 'line-through',
                color: '#155724'
              }
            }, item.name),
            React.createElement('button', {
              className: 'btn-danger',
              style: { padding: '4px 8px', fontSize: '0.85rem' },
              onClick: () => deleteItem(item.id)
            }, '×')
          )
        )
      )
    ),
    
    // Navigation
    React.createElement('div', {
      style: {
        marginTop: '24px',
        display: 'flex',
        gap: '12px'
      }
    },
      React.createElement('button', {
        className: 'btn-primary',
        onClick: () => navigate('dashboard')
      }, '← Back to Dashboard'),
      
      React.createElement('button', {
        className: 'btn-secondary',
        onClick: () => navigate('menu')
      }, 'Main Menu')
    )
  );
}