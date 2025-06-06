const recursivlyUpdateSelectors = ({
    valueMap,
    subscribersMap,
    subscribers,
    get,
}) => {
    for (const subscriber of subscribers) {
        if (subscriber.selector) {
            const currentValue = valueMap.get(subscriber)
            const updatedValue = subscriber.selector({ get })
            if (!subscriber.selector.equal(currentValue, updatedValue)) {
                valueMap.set(subscriber, updatedValue)
                const nestedSubscribers = subscribersMap.get(subscriber)
                if (nestedSubscribers && nestedSubscribers.size) {
                    recursivlyUpdateSelectors({
                        valueMap,
                        subscribersMap,
                        subscribers: nestedSubscribers,
                        get,
                    })
                }
            }
        } else {
            subscriber({ get })
        }
    }
}
