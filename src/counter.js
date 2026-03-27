/**
 * Sets up a simple counter element
 * Increments the counter each time the element is clicked
 * @param {HTMLElement} element - The DOM element to bind the counter to
 */
export function setupCounter(element) {
  let counter = 0
  const setCounter = (count) => {
    counter = count
    element.innerHTML = `Count is ${counter}`
  }
  element.addEventListener('click', () => setCounter(counter + 1))
  setCounter(0)
}
